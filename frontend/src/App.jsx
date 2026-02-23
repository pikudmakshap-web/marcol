import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import Users from './pages/admin/Users';
import Wallets from './pages/admin/Wallets';
import Products from './pages/admin/Products';
import Inventory from './pages/admin/Inventory';
import Reports from './pages/admin/Reports';
import Settings from './pages/admin/Settings';
import POSCheckout from './pages/pos/POSCheckout';
import OfficerDashboard from './pages/officer/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import './App.css';

function App() {
  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} toastOptions={{ className: 'font-sans font-bold shadow-lg rounded-xl text-center', style: { padding: '16px', color: '#166534', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' } }} />
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Main Routes wrapped with DashboardLayout for Sidebar */}
        <Route element={<DashboardLayout />}>
          {/* Admin Routes */}
          <Route element={<PrivateRoute allowedRoles={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/wallets" element={<Wallets />} />
            <Route path="/admin/products" element={<Products />} />
            <Route path="/admin/inventory" element={<Inventory />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/settings" element={<Settings />} />
            {/* Legacy redirect */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          </Route>

          {/* POS/Cashier Routes */}
          <Route element={<PrivateRoute allowedRoles={['admin', 'cashier']} />}>
            <Route path="/pos/checkout" element={<POSCheckout />} />
            {/* Legacy redirect */}
            <Route path="/pos" element={<Navigate to="/pos/checkout" replace />} />
          </Route>

          {/* Officer Routes */}
          <Route element={<PrivateRoute allowedRoles={['officer']} />}>
            <Route path="/officer/dashboard" element={<OfficerDashboard />} />
            {/* Legacy redirect */}
            <Route path="/officer" element={<Navigate to="/officer/dashboard" replace />} />
          </Route>
        </Route>

        {/* Global Fallbacks */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
