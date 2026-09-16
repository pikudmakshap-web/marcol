import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import Sidebar from '../Sidebar';
import GlobalNotification from '../GlobalNotification';
import { useProductStore } from '../../store/productStore';
import { useWalletStore } from '../../store/walletStore';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { socket, onDataUpdate } from '../../services/socketService';

const DashboardLayout = () => {
    const { user } = useAuthStore();
    const fetchProducts = useProductStore(state => state.fetchProducts);
    const addProduct = useProductStore(state => state.addProduct);
    const updateProductState = useProductStore(state => state.updateProductState);
    const removeProduct = useProductStore(state => state.removeProduct);
    const fetchWallets = useWalletStore(state => state.fetchWallets);
    const fetchUsers = useUserStore(state => state.fetchUsers);
    const addUser = useUserStore(state => state.addUser);
    const updateUserState = useUserStore(state => state.updateUserState);
    const removeUser = useUserStore(state => state.removeUser);
    const fetchDashboardStats = useDashboardStore(state => state.fetchDashboardStats);

    useEffect(() => {
        // Fetch global data based on user role
        fetchWallets(); // All roles need wallets
        if (user?.role === 'admin' || user?.role === 'cashier') {
            fetchProducts();
        }
        if (user?.role === 'admin') {
            fetchUsers();
            fetchDashboardStats(); // Preload dashboard stats for admins
        }

        // Connect Socket
        if (user?.id) {
            socket.auth = { userId: user.id };
        }
        socket.connect();

        // Global real-time listener (fallback cache invalidate)
        const unsubscribe = onDataUpdate((data) => {
            console.log('Real-time update received:', data);
            if (data?.type === 'wallet') {
                fetchWallets(true);
                if (user?.role === 'admin') fetchDashboardStats(true); // Update dashboard globally
            }
            if (data?.type === 'transaction') {
                if (user?.role === 'admin') fetchDashboardStats(true); // Update dashboard globally
            }
        });

        // Specific payload listeners for Products to prevent duplicate GET requests
        const handleProductAdded = (product) => {
            addProduct(product);
            if (user?.role === 'admin') fetchDashboardStats(true);
        };
        const handleProductUpdated = (product) => {
            updateProductState(product.id, product);
            if (user?.role === 'admin') fetchDashboardStats(true);
        };
        const handleProductDeleted = (productId) => {
            removeProduct(productId);
            if (user?.role === 'admin') fetchDashboardStats(true);
        };

        // Specific payload listeners for Users to prevent duplicate GET requests
        const handleUserAdded = (user) => addUser(user);
        const handleUserUpdated = (user) => updateUserState(user.id, user);
        const handleUserDeleted = (userId) => removeUser(userId);
        const handleUserStatusChange = ({ userId, isOnline, lastSeen }) => updateUserState(userId, { isOnline, lastSeen });

        // Listen to specific events only if the role is allowed to see them
        if (user?.role === 'admin' || user?.role === 'cashier') {
            socket.on('product_added', handleProductAdded);
            socket.on('product_updated', handleProductUpdated);
            socket.on('product_deleted', handleProductDeleted);
        }

        if (user?.role === 'admin') {
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
    }, [fetchProducts, fetchWallets, fetchUsers, fetchDashboardStats, addProduct, updateProductState, removeProduct, addUser, updateUserState, removeUser, user?.role, user?.id]);

    return (
        <div className="bg-[#f2f4f1] text-[#2d3748] font-display min-h-screen overflow-x-hidden selection:bg-[#3ce619] selection:text-white" dir="rtl">
            {/* Subtle Organic Backgrounds matching image vibe */}
            <div
                className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#e8f5e9] rounded-full blur-[120px] -z-10 opacity-60"
            ></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-[#f1f8e9] rounded-full blur-[100px] -z-10 opacity-60"></div>

            <div className="flex h-screen overflow-hidden">
                <GlobalNotification />
                {/* Fixed Sidebar */}
                {user?.role !== 'cashier' && <Sidebar />}

                {/* Main Content Area */}
                {/* Added mr-32 to account for the fixed sidebar on the right */}
                <main className={`flex-1 ${user?.role !== 'cashier' ? 'mr-32' : ''} p-6 h-full overflow-y-auto scroll-smooth scrollbar-hide`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
