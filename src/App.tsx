import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from '@/store/authStore';

// Layouts
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { ProtectedRoute } from '@/routes/ProtectedRoute';

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { OTPVerifyPage } from '@/pages/auth/OTPVerifyPage';

// Dashboard Pages
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ShopSetupPage } from '@/pages/shop/ShopSetupPage';
import { CategoriesPage } from '@/pages/menu/CategoriesPage';
import { MenuItemsPage } from '@/pages/menu/MenuItemsPage';
import { BulkUploadPage } from '@/pages/menu/BulkUploadPage';
import { ThemeCustomizePage } from '@/pages/customize/ThemeCustomizePage';
import { QRCodePage } from '@/pages/qr/QRCodePage';
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage';
import { DiscountsPage } from '@/pages/discounts/DiscountsPage';

// Public Pages
import { PublicMenuPage } from '@/pages/public/PublicMenuPage';
import { PublicItemPage } from '@/pages/public/PublicItemPage';
import { TermsPage } from '@/pages/public/TermsPage';
import { StoreDiscoveryPage } from '@/pages/public/StoreDiscoveryPage';

const AdminPlaceholder = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <h1 className="text-2xl font-bold font-heading mb-2">Admin Dashboard</h1>
      <p className="text-slate-500">Super admin management area coming soon.</p>
    </div>
  </div>
);

function App() {
  const { fetchUser, isLoading } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-otp" element={<OTPVerifyPage />} />
      </Route>
      
      {/* Dashboard Routes (Protected) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/shop-setup" element={<ShopSetupPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/menu-items" element={<MenuItemsPage />} />
          <Route path="/bulk-upload" element={<BulkUploadPage />} />
          <Route path="/customize" element={<ThemeCustomizePage />} />
          <Route path="/qr-code" element={<QRCodePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/discounts" element={<DiscountsPage />} />
          <Route path="/admin" element={<AdminPlaceholder />} />
        </Route>
      </Route>

      {/* Public Routes */}
      <Route path="/discover" element={<StoreDiscoveryPage />} />
      <Route path="/shop/:id" element={<PublicMenuPage />} />
      <Route path="/shop/:id/item/:itemId" element={<PublicItemPage />} />
      <Route path="/terms" element={<TermsPage />} />

      {/* Fallback routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
