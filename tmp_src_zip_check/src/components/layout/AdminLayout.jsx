import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './AdminLayout.css';

function AdminLayout() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>מערכת ניהול</h2>
                    <p>POS Admin</p>
                </div>

                <nav className="sidebar-nav">
                    <Link to="/admin" className="nav-item">
                        <span className="icon">📊</span>
                        <span>דאשבורד</span>
                    </Link>
                    <Link to="/admin/users" className="nav-item">
                        <span className="icon">👥</span>
                        <span>משתמשים</span>
                    </Link>
                    <Link to="/admin/wallets" className="nav-item">
                        <span className="icon">💰</span>
                        <span>ארנקים</span>
                    </Link>
                    <Link to="/admin/products" className="nav-item">
                        <span className="icon">📦</span>
                        <span>מוצרים</span>
                    </Link>

                    <Link to="/admin/reports" className="nav-item">
                        <span className="icon">📈</span>
                        <span>דוחות</span>
                    </Link>
                </nav>

                <div className="sidebar-footer">
                    <Link to="/pos" className="nav-item secondary">
                        <span className="icon">🏪</span>
                        <span>עבור לקופה</span>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                {/* Header */}
                <header className="header">
                    <div className="header-right">
                        <h1>ברוך הבא, {user?.fullName}</h1>
                    </div>
                    <div className="header-left">
                        <div className="user-info">
                            <span className="user-role">{user?.role === 'admin' ? 'מנהל' : user?.role}</span>
                            <button onClick={handleLogout} className="logout-btn">
                                יציאה
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default AdminLayout;
