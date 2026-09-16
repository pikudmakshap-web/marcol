import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Sidebar = ({ onHelpClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        const hasDarkClass = document.documentElement.classList.contains('dark');
        setIsDarkMode(hasDarkClass);
    }, []);

    const isActive = (path) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    const isSuperAdmin = user?.role === 'superadmin';
    const isAdmin = user?.role === 'admin' || isSuperAdmin;
    const isOfficer = user?.role === 'officer';
    const isCashier = user?.role === 'cashier';

    const navigation = [
        { icon: 'dashboard', label: 'לוח בקרה', path: '/admin/dashboard', show: isAdmin },
        { icon: 'point_of_sale', label: 'קופה', path: '/pos/checkout', show: isAdmin || isCashier },
        { icon: 'inventory_2', label: 'מוצרים', path: '/admin/products', show: isAdmin || isOfficer || isCashier },
        { icon: 'account_balance_wallet', label: 'ארנקים', path: '/admin/wallets', show: isAdmin || isOfficer },
        { icon: 'group', label: 'משתמשים', path: '/admin/users', show: isAdmin },
    ].filter(item => item.show);

    const toggleTheme = () => {
        const nextIsDark = !isDarkMode;
        setIsDarkMode(nextIsDark);
        document.documentElement.classList.toggle('dark', nextIsDark);
        localStorage.setItem('theme', nextIsDark ? 'dark' : 'light');
    };

    return (
        <aside className="fixed right-6 top-6 bottom-6 w-20 bg-white rounded-[40px] shadow-[0_4px_30px_rgb(0,0,0,0.05)] flex flex-col items-center py-6 z-[9999] overflow-hidden border border-gray-100">
            <button
                onClick={() => navigate('/admin/dashboard')}
                className="mb-8 w-12 h-12 bg-[#ecfdf5] rounded-full flex items-center justify-center text-[#3ce619] shadow-inner shrink-0 hover:scale-110 transition-transform"
            >
                <span className="material-symbols-outlined text-2xl font-bold">eco</span>
            </button>

            <nav className="flex-1 flex flex-col gap-6 w-full px-2 items-center justify-start py-2">
                {navigation.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 relative group ${isActive(item.path)
                            ? 'bg-[#3ce619] text-white shadow-[0_8px_20px_rgba(60,230,25,0.4)] scale-110'
                            : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                            }`}
                        title={item.label}
                    >
                        <span className="material-symbols-outlined text-[28px]">{item.icon}</span>

                        <div className="absolute right-16 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[10000]">
                            {item.label}
                        </div>
                    </button>
                ))}
            </nav>

            <div className="flex flex-col gap-6 w-full px-2 mt-auto shrink-0 items-center">
                <button
                    type="button"
                    onClick={toggleTheme}
                    className="w-14 h-14 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                    title={isDarkMode ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
                >
                    <span className="material-symbols-outlined text-[28px]">
                        {isDarkMode ? 'light_mode' : 'dark_mode'}
                    </span>
                </button>

                {isAdmin && (
                    <button
                        onClick={() => navigate('/admin/settings')}
                        className="w-14 h-14 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[28px]">settings</span>
                    </button>
                )}

                <div className="relative cursor-pointer group w-12 h-12 mb-2" onClick={() => navigate('/profile')}>
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-transparent group-hover:border-[#3ce619] transition-colors relative z-10">
                        <img
                            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80"
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#3ce619] rounded-full border-2 border-white z-20"></div>
                </div>

                <button
                    type="button"
                    onClick={onHelpClick}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors -mt-8 mb-1"
                    title="עזרה"
                >
                    <span className="material-symbols-outlined text-[18px]">help</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
