import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import MainPortalLayout from './layouts/MainPortalLayout';
import HomePage from './pages/HomePage';
import UnitSubsitePage from './pages/UnitSubsitePage';
import DesignPage from './pages/DesignPage';
import GalleryPage from './pages/GalleryPage';
import BlogPage from './pages/BlogPage';
import CategoryPage from './pages/CategoryPage';
import ResourcePage from './pages/ResourcePage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainPortalLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/units/:unitId" element={<UnitSubsitePage />} />
          <Route path="/design" element={<DesignPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/category/:categoryId" element={<CategoryPage />} />
          <Route path="/resource/:resourceId" element={<ResourcePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
