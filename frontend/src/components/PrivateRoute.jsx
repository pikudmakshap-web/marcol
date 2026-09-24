import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

function PrivateRoute({ allowedRoles }) {
    const { isAuthenticated, user } = useAuthStore();
    const parentOutletContext = useOutletContext();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // If the route allows 'admin', it also allows 'superadmin'
    const rolesToMatch = allowedRoles?.includes('admin') && user?.role === 'superadmin' 
        ? [...allowedRoles, 'superadmin'] 
        : allowedRoles;

    if (rolesToMatch && !rolesToMatch.includes(user?.role)) {
        // Redirect based on user role
        if (user?.role === 'superadmin') {
            return <Navigate to="/admin/environments" replace />;
        } else if (user?.role === 'admin') {
            return <Navigate to="/admin" replace />;
        } else if (user?.role === 'cashier') {
            return <Navigate to="/pos" replace />;
        } else if (user?.role === 'officer') {
            return <Navigate to="/officer" replace />;
        }
        return <Navigate to="/login" replace />;
    }

    if (user?.role === 'superadmin' && !user?.environmentId && !allowedRoles?.includes('superadmin')) {
        return <Navigate to="/admin/environments" replace />;
    }

    return <Outlet context={parentOutletContext} />;
}

export default PrivateRoute;
