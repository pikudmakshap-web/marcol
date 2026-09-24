import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import './Sidebar.compact.v3.css';

const Sidebar = ({ onHelpClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        setIsDarkMode(document.documentElement.classList.contains('dark'));
    }, []);

    const isActive = (route) => location.pathname === route || location.pathname.startsWith(route + '/');
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
        { icon: 'assessment', label: 'דוחות', path: '/admin/reports', show: isAdmin },
    ].filter(item => item.show);

    const toggleTheme = () => {
        const nextIsDark = !document.documentElement.classList.contains('dark');
        setIsDarkMode(nextIsDark);
        document.documentElement.classList.toggle('dark', nextIsDark);
        try { localStorage.setItem('theme', nextIsDark ? 'dark' : 'light'); } catch { /* Theme still works without storage. */ }
    };
    const themeLabel = isDarkMode ? 'מעבר למצב בהיר' : 'מעבר למצב כהה';

    return (
        <aside className="marcol-sidebar-v3" aria-label="סרגל צדדי">
            <button type="button" onClick={() => navigate('/admin/dashboard')} className="marcol-sidebar-v3__brand" title="Marcol" aria-label="Marcol">
                <span className="material-symbols-outlined" aria-hidden="true">eco</span>
            </button>
            <nav className="marcol-sidebar-v3__nav" aria-label="ניווט ראשי">
                {navigation.map(item => (
                    <button type="button" key={item.path} onClick={() => navigate(item.path)}
                        className={`marcol-sidebar-v3__button${isActive(item.path) ? ' is-active' : ''}`}
                        title={item.label} aria-label={item.label} aria-current={isActive(item.path) ? 'page' : undefined}>
                        <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                    </button>
                ))}
            </nav>
            <div className="marcol-sidebar-v3__tools" role="group" aria-label="כלי מערכת">
                <button type="button" onClick={toggleTheme} className="marcol-sidebar-v3__button" title={themeLabel} aria-label={themeLabel}>
                    <span className="material-symbols-outlined" aria-hidden="true">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                </button>
                {isAdmin && <button type="button" onClick={() => navigate('/admin/settings')}
                    className={`marcol-sidebar-v3__button${isActive('/admin/settings') ? ' is-active' : ''}`}
                    title="הגדרות" aria-label="הגדרות" aria-current={isActive('/admin/settings') ? 'page' : undefined}>
                    <span className="material-symbols-outlined" aria-hidden="true">settings</span>
                </button>}
            </div>
            <div className="marcol-sidebar-v3__footer">
                <button type="button" className="marcol-sidebar-v3__profile" onClick={() => navigate('/profile')} title="חשבון משתמש" aria-label="חשבון משתמש">
                    <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80" alt="" />
                    <span className="marcol-sidebar-v3__presence" aria-hidden="true" />
                </button>
                <button type="button" onClick={onHelpClick} className="marcol-sidebar-v3__button marcol-sidebar-v3__help" title="עזרה" aria-label="עזרה">
                    <span className="material-symbols-outlined" aria-hidden="true">help</span>
                </button>
            </div>
        </aside>
    );
};
export default Sidebar;
