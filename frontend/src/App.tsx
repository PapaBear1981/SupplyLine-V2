import "@shared/styles/aesthetic-improvements.css";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { ConfigProvider as MobileConfigProvider } from 'antd-mobile';
import { ResponsiveLayout } from '@shared/components/layouts/ResponsiveLayout';
import { ResponsiveAuthLayout } from '@shared/components/layouts/ResponsiveAuthLayout';
import { ResponsivePage } from '@shared/components/layouts/ResponsivePage';
import { MobileComingSoon } from '@shared/components/mobile/MobileComingSoon';
import { ProtectedRoute } from '@features/auth/components/ProtectedRoute';
import { AdminRoute } from '@features/auth/components/AdminRoute';
import { PermissionProvider } from '@features/auth/context/PermissionContext';
import { MobileProvider } from '@shared/contexts/MobileContext';
import { ScannerProvider } from '@features/scanner';
import { LoginPage } from '@features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@features/auth/pages/ForgotPasswordPage';
import { DashboardPage } from '@features/dashboard/pages/DashboardPage';
import { ToolsPage } from '@features/tools/pages/ToolsPage';
import { ToolCheckoutPage } from '@features/tool-checkout';
import { ChemicalsPage } from '@features/chemicals/pages/ChemicalsPage';
import { ChemicalForecastPage } from '@features/chemicals/pages/ChemicalForecastPage';
import { MobileChemicalForecast } from '@features/chemicals/components/mobile';
import { WarehousesPage } from '@features/warehouses/pages/WarehousesPage';
import { SettingsPage } from '@features/settings/pages/SettingsPage';
import { ProfilePage } from '@features/profile/pages/ProfilePage';
import { UsersPage } from '@features/users/pages/UsersPage';
import { AdminPageWrapper } from '@features/admin/components/AdminPageWrapper';
import { KitsDashboard, KitDetailView, KitWizard, MobileKitWizard } from '@features/kits';
import {
  OrdersDashboard,
  OrderDetailView,
  OrderCreationForm,
  RequestsDashboard,
  RequestDetailView,
  RequestCreationForm,
  MobileOrderDetail,
  MobileOrderCreationForm,
  MobileRequestDetail,
  MobileRequestCreationForm,
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
            <ScannerProvider>
            <Routes>
              {/* Auth Routes */}
              <Route element={<ResponsiveAuthLayout />}>
                <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<ResponsiveLayout />}>
                  <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
                  <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
                  <Route path={ROUTES.TOOL_CHECKOUT} element={<ToolCheckoutPage />} />
                  <Route path={ROUTES.TOOLS} element={<ToolsPage />} />
                  <Route path={ROUTES.CHEMICALS} element={<ChemicalsPage />} />
                  <Route
                    path={ROUTES.CHEMICAL_FORECAST}
                    element={
                      <ResponsivePage
                        desktop={<ChemicalForecastPage />}
                        mobile={<MobileChemicalForecast />}
                      />
                    }
                  />

                  {/* Kits Routes */}
                  <Route path={ROUTES.KITS} element={<KitsDashboard />} />
                  <Route
                    path="/kits/new"
                    element={
                      <ResponsivePage
                        desktop={<KitWizard />}
                        mobile={<MobileKitWizard />}
                      />
                    }
                  />
                  <Route path="/kits/:id" element={<KitDetailView />} />
                  <Route path="/kits/:id/edit" element={<div>Edit Kit (Coming Soon)</div>} />
                  <Route path="/kits/:id/duplicate" element={<div>Duplicate Kit (Coming Soon)</div>} />

                  {/* Orders Routes */}
                  <Route path="/orders" element={<OrdersDashboard />} />
                  <Route
                    path="/orders/new"
                    element={
                      <ResponsivePage
                        desktop={<OrderCreationForm />}
                        mobile={<MobileOrderCreationForm />}
                      />
                    }
                  />
                  <Route
                    path="/orders/:orderId"
                    element={
                      <ResponsivePage
                        desktop={<OrderDetailView />}
                        mobile={<MobileOrderDetail />}
                      />
                    }
                  />

                  {/* Requests Routes */}
                  <Route path="/requests" element={<RequestsDashboard />} />
                  <Route
                    path="/requests/new"
                    element={
                      <ResponsivePage
                        desktop={<RequestCreationForm />}
                        mobile={<MobileRequestCreationForm />}
                      />
                    }
                  />
                  <Route
                    path="/requests/:requestId"
                    element={
                      <ResponsivePage
                        desktop={<RequestDetailView />}
                        mobile={<MobileRequestDetail />}
                      />
                    }
                  />

                  <Route path={ROUTES.WAREHOUSES} element={<WarehousesPage />} />
                  <Route path={ROUTES.REPORTS} element={<ReportsPage />} />
                  <Route
                    path={ROUTES.USERS}
                    element={
                      <ResponsivePage
                        desktop={<UsersPage />}
                        mobile={<MobileComingSoon feature="User Management" />}
                      />
                    }
                  />
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
            </ScannerProvider>
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
