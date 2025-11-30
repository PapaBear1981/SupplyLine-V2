import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { MainLayout } from '@shared/components/layouts/MainLayout';
import { AuthLayout } from '@shared/components/layouts/AuthLayout';
import { ProtectedRoute } from '@features/auth/components/ProtectedRoute';
import { AdminRoute } from '@features/auth/components/AdminRoute';
// PageGuard available for route protection: import { PageGuard } from '@features/auth/components/PageGuard';
import { PermissionProvider } from '@features/auth/context/PermissionContext';
import { LoginPage } from '@features/auth/pages/LoginPage';
import { DashboardPage } from '@features/dashboard/pages/DashboardPage';
import { ToolsPage } from '@features/tools/pages/ToolsPage';
import { ToolCheckoutPage } from '@features/tool-checkout';
import { ChemicalsPage } from '@features/chemicals/pages/ChemicalsPage';
import { WarehousesPage } from '@features/warehouses/pages/WarehousesPage';
import { SettingsPage } from '@features/settings/pages/SettingsPage';
import { ProfilePage } from '@features/profile/pages/ProfilePage';
import { UsersPage } from '@features/users/pages/UsersPage';
import { AdminPage } from '@features/admin/pages/AdminPage';
import { KitsDashboard, KitDetailView, KitWizard } from '@features/kits';
import {
  OrdersDashboard,
  OrderDetailView,
  OrderCreationForm,
  RequestsDashboard,
  RequestDetailView,
  RequestCreationForm,
} from '@features/orders';
import { ReportsPage } from '@features/reports';
import { ThemeProvider, useTheme } from '@features/settings/contexts/ThemeContext';
import { COLOR_THEMES } from '@features/settings/types/theme';
import { ROUTES } from '@shared/constants/routes';

function AppContent() {
  const { themeConfig } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: themeConfig.mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: COLOR_THEMES[themeConfig.colorTheme].primary,
          borderRadius: 6,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
              <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
              <Route path={ROUTES.TOOL_CHECKOUT} element={<ToolCheckoutPage />} />
              <Route path={ROUTES.TOOLS} element={<ToolsPage />} />
              <Route path={ROUTES.CHEMICALS} element={<ChemicalsPage />} />

              {/* Kits Routes */}
              <Route path={ROUTES.KITS} element={<KitsDashboard />} />
              <Route path="/kits/new" element={<KitWizard />} />
              <Route path="/kits/:id" element={<KitDetailView />} />
              <Route path="/kits/:id/edit" element={<div>Edit Kit (Coming Soon)</div>} />
              <Route path="/kits/:id/duplicate" element={<div>Duplicate Kit (Coming Soon)</div>} />

              {/* Orders Routes */}
              <Route path="/orders" element={<OrdersDashboard />} />
              <Route path="/orders/new" element={<OrderCreationForm />} />
              <Route path="/orders/:orderId" element={<OrderDetailView />} />

              {/* Requests Routes */}
              <Route path="/requests" element={<RequestsDashboard />} />
              <Route path="/requests/new" element={<RequestCreationForm />} />
              <Route path="/requests/:requestId" element={<RequestDetailView />} />

              <Route path={ROUTES.WAREHOUSES} element={<WarehousesPage />} />
              <Route path={ROUTES.REPORTS} element={<ReportsPage />} />
              <Route path={ROUTES.USERS} element={<UsersPage />} />
              <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
              <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />

              {/* Admin-only routes */}
              <Route element={<AdminRoute />}>
                <Route path={ROUTES.ADMIN} element={<AdminPage />} />
              </Route>
            </Route>
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <PermissionProvider>
        <AppContent />
      </PermissionProvider>
    </ThemeProvider>
  );
}

export default App;
