import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

function PrivateRoute({ allowedRoles }) {
    const { isAuthenticated, user } = useAuthStore();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        // Redirect based on user role
        if (user?.role === 'admin') {
            return <Navigate to="/admin" replace />;
        } else if (user?.role === 'cashier') {
            return <Navigate to="/pos" replace />;
        } else if (user?.role === 'officer') {
            return <Navigate to="/officer" replace />;
        }
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

export default PrivateRoute;
