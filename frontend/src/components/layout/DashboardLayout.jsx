import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from '../Sidebar';
import GlobalNotification from '../GlobalNotification';
import HelpTutorialModal from '../HelpTutorialModal';
import { useProductStore } from '../../store/productStore';
import { useWalletStore } from '../../store/walletStore';
import { useUserStore } from '../../store/userStore';
import { useCategoryStore } from '../../store/categoryStore';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { socket, onDataUpdate } from '../../services/socketService';

const DashboardLayout = () => {
    const { user, refreshUser } = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [helpRestartToken, setHelpRestartToken] = useState(0);
    const [pendingHelpRoute, setPendingHelpRoute] = useState(null);
    const fetchProducts = useProductStore(state => state.fetchProducts);
    const addProduct = useProductStore(state => state.addProduct);
    const updateProductState = useProductStore(state => state.updateProductState);
    const removeProduct = useProductStore(state => state.removeProduct);
    const fetchWallets = useWalletStore(state => state.fetchWallets);
    const fetchUsers = useUserStore(state => state.fetchUsers);
    const fetchCategories = useCategoryStore(state => state.fetchCategories);
    const addUser = useUserStore(state => state.addUser);
    const updateUserState = useUserStore(state => state.updateUserState);
    const removeUser = useUserStore(state => state.removeUser);
    const fetchDashboardStats = useDashboardStore(state => state.fetchDashboardStats);

    useEffect(() => {
        if (user && !user.authorizedEnvironments) {
            refreshUser();
        }
    }, [user, refreshUser]);

    useEffect(() => {
        const currentEnvName = user?.authorizedEnvironments?.find((env) => env.id === user?.environmentId)?.name;
        const fallbackName = currentEnvName || user?.environmentName || 'Dashboard';
        document.title = `${fallbackName} | Marcol`;
    }, [user?.authorizedEnvironments, user?.environmentId, user?.environmentName]);

    useEffect(() => {
        if (!user?.id) return;

        // Fetch global data based on user role
        fetchWallets({ reset: true, limit: 50 }); // All roles need wallets
        fetchCategories();
        if (user?.role === 'cashier') {
            // POS relies on full product catalog for fast local search
            fetchProducts({ reset: true, all: true });
        } else if (user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'officer') {
            fetchProducts({ reset: true, limit: 100 });
        }
        if (user?.role === 'admin' || user?.role === 'superadmin') {
            fetchUsers(true);
            fetchDashboardStats(); // Preload dashboard stats for admins
        }

        // Connect Socket
        socket.auth = { userId: user.id };
        if (!socket.connected) {
            socket.connect();
        }

        // Global real-time listener (fallback cache invalidate)
        const unsubscribe = onDataUpdate((data) => {
            console.log('Real-time update received:', data);
            if (data?.type === 'wallet') {
                fetchWallets({ force: true, reset: true, limit: 50 });
                if (user?.role === 'admin' || user?.role === 'superadmin') fetchDashboardStats(true); // Update dashboard globally
            }
            if (data?.type === 'transaction') {
                if (user?.role === 'admin' || user?.role === 'superadmin') fetchDashboardStats(true); // Update dashboard globally
            }
        });

        // Specific payload listeners for Products to prevent duplicate GET requests
        const handleProductAdded = (product) => {
            addProduct(product);
            if (user?.role === 'admin' || user?.role === 'superadmin') fetchDashboardStats(true);
        };
        const handleProductUpdated = (product) => {
            updateProductState(product.id, product);
            if (user?.role === 'admin' || user?.role === 'superadmin') fetchDashboardStats(true);
        };
        const handleProductDeleted = (productId) => {
            removeProduct(productId);
            if (user?.role === 'admin' || user?.role === 'superadmin') fetchDashboardStats(true);
        };

        // Specific payload listeners for Users to prevent duplicate GET requests
        const handleUserAdded = (user) => addUser(user);
        const handleUserUpdated = (user) => updateUserState(user.id, user);
        const handleUserDeleted = (userId) => removeUser(userId);
        const handleUserStatusChange = ({ userId, isOnline, lastSeen }) => updateUserState(userId, { isOnline, lastSeen });

        // Listen to specific events only if the role is allowed to see them
        if (user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'cashier') {
            socket.on('product_added', handleProductAdded);
            socket.on('product_updated', handleProductUpdated);
            socket.on('product_deleted', handleProductDeleted);
        }

        if (user?.role === 'admin' || user?.role === 'superadmin') {
            socket.on('user_added', handleUserAdded);
            socket.on('user_updated', handleUserUpdated);
            socket.on('user_deleted', handleUserDeleted);
            socket.on('user_status_change', handleUserStatusChange);
        }

        return () => {
            unsubscribe();
            socket.off('product_added', handleProductAdded);
            socket.off('product_updated', handleProductUpdated);
            socket.off('product_deleted', handleProductDeleted);

            socket.off('user_added', handleUserAdded);
            socket.off('user_updated', handleUserUpdated);
            socket.off('user_deleted', handleUserDeleted);
            socket.off('user_status_change', handleUserStatusChange);
            socket.disconnect();
        };
    }, [fetchProducts, fetchWallets, fetchUsers, fetchCategories, fetchDashboardStats, addProduct, updateProductState, removeProduct, addUser, updateUserState, removeUser, user?.role, user?.id, user?.environmentId]);

    const isSuperAdminEnvView = location.pathname.startsWith('/admin/environments');
    const isCashierView = user?.role === 'cashier';
    const getRoleHomeRoute = (role) => (
        role === 'superadmin'
            ? '/admin/environments'
            : role === 'cashier'
                ? '/pos/checkout'
                : role === 'officer'
                    ? '/admin/wallets'
                    : '/admin/dashboard'
    );

    useEffect(() => {
        if (!pendingHelpRoute) return;
        if (location.pathname !== pendingHelpRoute) return;

        setPendingHelpRoute(null);
        setHelpRestartToken((prev) => prev + 1);
        setIsHelpOpen(true);
    }, [location.pathname, pendingHelpRoute]);

    const handleHelpClick = () => {
        const roleHomeRoute = getRoleHomeRoute(user?.role);

        if (location.pathname !== roleHomeRoute) {
            setIsHelpOpen(false);
            setPendingHelpRoute(roleHomeRoute);
            navigate(roleHomeRoute);
            return;
        }

        setPendingHelpRoute(null);
        setHelpRestartToken((prev) => prev + 1);
        setIsHelpOpen(true);
    };

    const extractEnvironmentParts = (value) => {
        const raw = String(value || '');
        const symbols = raw.match(/\p{Extended_Pictographic}/gu) || [];
        const baseName = raw.replace(/\p{Extended_Pictographic}/gu, '').trim();
        return { baseName, symbols };
    };

    const currentEnv = user?.authorizedEnvironments?.find((env) => env.id === user?.environmentId);
    const canSwitchEnvironment = (user?.authorizedEnvironments?.length || 0) > 1;
    const { baseName: envBaseName, symbols: envTextSymbols } = extractEnvironmentParts(
        currentEnv?.name || user?.environmentName || ''
    );
    const envImageSymbols = Array.isArray(currentEnv?.symbolImageUrls)
        ? currentEnv.symbolImageUrls.slice(0, 4)
        : [];
    const showMiniEnvBadge = location.pathname !== '/admin/dashboard';

    return (
        <div className="bg-[#f2f4f1] text-[#2d3748] font-display min-h-screen overflow-x-hidden selection:bg-[#3ce619] selection:text-white" dir="rtl">
            {/* Subtle Organic Backgrounds matching image vibe */}
            <div
                className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#e8f5e9] rounded-full blur-[120px] -z-10 opacity-60"
            ></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-[#f1f8e9] rounded-full blur-[100px] -z-10 opacity-60"></div>

            <div className="flex h-screen overflow-hidden">
                <GlobalNotification />
                {/* Fixed Sidebar - Hidden in Super Admin Env Management */}
                {!isSuperAdminEnvView && !isCashierView && <Sidebar onHelpClick={handleHelpClick} />}

                {/* Main Content Area */}
                <main className={`flex-1 ${!isSuperAdminEnvView && !isCashierView ? 'mr-[6.75rem]' : ''} p-6 h-full ${isSuperAdminEnvView ? 'overflow-hidden' : 'overflow-y-auto'} scroll-smooth scrollbar-hide`}>
                    {showMiniEnvBadge && (
                        <div className="mb-1 flex justify-start">
                            <div className="h-6 flex items-center gap-1">
                                {envImageSymbols.slice(0, 4).map((imageSrc, index) => (
                                    <span key={`layout-env-img-${index}`} className="w-4 h-4 overflow-hidden flex items-center justify-center">
                                        <img src={imageSrc} alt={`env-symbol-${index + 1}`} className="w-full h-full object-contain" />
                                    </span>
                                ))}
                                {envTextSymbols.slice(0, 4).map((symbol, index) => (
                                    <span key={`layout-env-text-${index}`} className="w-4 h-4 flex items-center justify-center text-[10px]">
                                        {symbol}
                                    </span>
                                ))}
                                <span className="text-[11px] font-bold text-slate-700 leading-none truncate max-w-[120px]">
                                    {envBaseName || 'Marcol'}
                                </span>
                            </div>
                        </div>
                    )}
                    <Outlet context={{ onHelpClick: handleHelpClick }} />
                </main>
            </div>
            <HelpTutorialModal
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
                userRole={user?.role}
                currentPath={location.pathname}
                restartToken={helpRestartToken}
                canSwitchEnvironment={canSwitchEnvironment}
            />
        </div>
    );
};

export default DashboardLayout;
