import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from '../Sidebar';
import GlobalNotification from '../GlobalNotification';
import { useProductStore } from '../../store/productStore';
import { useWalletStore } from '../../store/walletStore';
import { useUserStore } from '../../store/userStore';

const DashboardLayout = () => {
    const fetchProducts = useProductStore(state => state.fetchProducts);
    const fetchWallets = useWalletStore(state => state.fetchWallets);
    const fetchUsers = useUserStore(state => state.fetchUsers);

    useEffect(() => {
        // Fetch all global data when dashboard loads
        fetchProducts();
        fetchWallets();
        fetchUsers();
    }, [fetchProducts, fetchWallets, fetchUsers]);

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
                <Sidebar />

                {/* Main Content Area */}
                {/* Added mr-32 to account for the fixed sidebar on the right */}
                <main className="flex-1 mr-32 p-6 h-full overflow-y-auto scroll-smooth scrollbar-hide">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
