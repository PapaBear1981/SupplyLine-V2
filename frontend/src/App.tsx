import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { ConfigProvider as MobileConfigProvider } from 'antd-mobile';
import { ResponsiveLayout } from '@shared/components/layouts/ResponsiveLayout';
import { ResponsiveAuthLayout } from '@shared/components/layouts/ResponsiveAuthLayout';
import { ProtectedRoute } from '@features/auth/components/ProtectedRoute';
import { AdminRoute } from '@features/auth/components/AdminRoute';
import { PermissionProvider } from '@features/auth/context/PermissionContext';
import { MobileProvider } from '@shared/contexts/MobileContext';
import { HotkeyProvider } from '@shared/contexts/HotkeyContext';
import { HotkeyHelp } from '@shared/components/HotkeyHelp';
import { LoginPage } from '@features/auth/pages/LoginPage';
import { DashboardPage } from '@features/dashboard/pages/DashboardPage';
import { ToolsPage } from '@features/tools/pages/ToolsPage';
import { ToolCheckoutPage } from '@features/tool-checkout';
import { ChemicalsPage } from '@features/chemicals/pages/ChemicalsPage';
import { WarehousesPage } from '@features/warehouses/pages/WarehousesPage';
import { SettingsPage } from '@features/settings/pages/SettingsPage';
import { ProfilePage } from '@features/profile/pages/ProfilePage';
import { UsersPage } from '@features/users/pages/UsersPage';
import { AdminPageWrapper } from '@features/admin/components/AdminPageWrapper';
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
  const isDark = themeConfig.mode === 'dark';
  const primaryColor = COLOR_THEMES[themeConfig.colorTheme].primary;

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: primaryColor,
          borderRadius: 6,
        },
      }}
    >
      <MobileConfigProvider>
        <div className={isDark ? 'adm-theme-dark' : ''}>
          <BrowserRouter>
            <HotkeyProvider>
              <Routes>
                {/* Auth Routes */}
                <Route element={<ResponsiveAuthLayout />}>
                  <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                </Route>

                {/* Protected Routes */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<ResponsiveLayout />}>
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

                    {/* Admin-only routes - Desktop only on mobile */}
                    <Route element={<AdminRoute />}>
                      <Route path={ROUTES.ADMIN} element={<AdminPageWrapper />} />
                    </Route>
                  </Route>
                </Route>

                {/* 404 Route */}
                <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
              </Routes>
              <HotkeyHelp />
            </HotkeyProvider>
          </BrowserRouter>
        </div>
      </MobileConfigProvider>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <PermissionProvider>
        <MobileProvider>
          <AppContent />
        </MobileProvider>
      </PermissionProvider>
    </ThemeProvider>
  );
}

export default App;
