import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

export default function MainPortalLayout() {
  return (
    <div className="app-shell" dir="rtl">
      <Header />
      <Outlet />
    </div>
  );
}
