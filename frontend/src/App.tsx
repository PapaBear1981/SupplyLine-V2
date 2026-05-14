import "@shared/styles/aesthetic-improvements.css";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { ConfigProvider as MobileConfigProvider } from 'antd-mobile';
import { ResponsiveLayout } from '@shared/components/layouts/ResponsiveLayout';
import { ResponsiveAuthLayout } from '@shared/components/layouts/ResponsiveAuthLayout';
import { ResponsivePage } from '@shared/components/layouts/ResponsivePage';
import { ProtectedRoute } from '@features/auth/components/ProtectedRoute';
import { AdminRoute } from '@features/auth/components/AdminRoute';
import { FeatureRoute } from '@features/auth/components/FeatureRoute';
import { PermissionProvider } from '@features/auth/context/PermissionContext';
import { MobileProvider } from '@shared/contexts/MobileContext';
import { ScannerProvider } from '@features/scanner';
import { LoginPage } from '@features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@features/auth/pages/ForgotPasswordPage';
import { DashboardPage } from '@features/dashboard/pages/DashboardPage';
import { ToolsPage } from '@features/tools/pages/ToolsPage';
import { ToolCheckoutPage, ToolAuditHistoryPage, MobileToolAuditHistory } from '@features/tool-checkout';
import { ChemicalsPage } from '@features/chemicals/pages/ChemicalsPage';
import { ChemicalForecastPage } from '@features/chemicals/pages/ChemicalForecastPage';
import { MobileChemicalForecast } from '@features/chemicals/components/mobile';
import { WarehousesPage } from '@features/warehouses/pages/WarehousesPage';
import { TransfersPage } from '@features/transfers/pages/TransfersPage';
import { SettingsPage } from '@features/settings/pages/SettingsPage';
import { ProfilePage } from '@features/profile/pages/ProfilePage';
import { AdminPageWrapper } from '@features/admin/components/AdminPageWrapper';
import { KitsDashboard, KitDetailView, KitWizard, MobileKitWizard } from '@features/kits';
import MasterKitsAdmin from '@features/master-kits/pages/MasterKitsAdmin';
import { DisplayPage } from '@features/display/pages/DisplayPage';
import { OnCallSchedulePage } from '@features/oncall';
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
                {/* Full-screen kiosk display: no sidebar/topbar */}
                <Route path={ROUTES.DISPLAY} element={<DisplayPage />} />
                <Route element={<ResponsiveLayout />}>
                  <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
                  <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
                  <Route path={ROUTES.TOOL_CHECKOUT} element={<ToolCheckoutPage />} />
                  <Route path={ROUTES.TOOL_HISTORY} element={
                    <ResponsivePage
                      desktop={<ToolAuditHistoryPage />}
                      mobile={<MobileToolAuditHistory />}
                    />
                  } />
                  <Route path={ROUTES.TOOLS} element={<ToolsPage />} />
                  <Route path={ROUTES.CHEMICALS} element={<ChemicalsPage />} />
                  <Route
                    path={ROUTES.CHEMICAL_FORECAST}
                    element={
                      <FeatureRoute feature="chemicalReorder" redirectTo={ROUTES.CHEMICALS}>
                        <ResponsivePage
                          desktop={<ChemicalForecastPage />}
                          mobile={<MobileChemicalForecast />}
                        />
                      </FeatureRoute>
                    }
                  />

                  {/* Kits Routes — KITS landing stays live as the slim Field
                      Locations admin; wizard / detail / edit are gated behind
                      the kit-management feature flag. */}
                  <Route path={ROUTES.KITS} element={<KitsDashboard />} />
                  <Route
                    path="/kits/new"
                    element={
                      <FeatureRoute feature="kitManagement" redirectTo={ROUTES.KITS}>
                        <ResponsivePage
                          desktop={<KitWizard />}
                          mobile={<MobileKitWizard />}
                        />
                      </FeatureRoute>
                    }
                  />
                  <Route
                    path="/kits/:id"
                    element={
                      <FeatureRoute feature="kitManagement" redirectTo={ROUTES.KITS}>
                        <KitDetailView />
                      </FeatureRoute>
                    }
                  />
                  <Route
                    path="/kits/:id/edit"
                    element={
                      <FeatureRoute feature="kitManagement" redirectTo={ROUTES.KITS}>
                        <div>Edit Kit (Coming Soon)</div>
                      </FeatureRoute>
                    }
                  />
                  <Route
                    path="/kits/:id/duplicate"
                    element={
                      <FeatureRoute feature="kitManagement" redirectTo={ROUTES.KITS}>
                        <div>Duplicate Kit (Coming Soon)</div>
                      </FeatureRoute>
                    }
                  />

                  {/* Orders Routes — gated by the requests feature flag. */}
                  <Route
                    path="/orders"
                    element={
                      <FeatureRoute feature="requests">
                        <OrdersDashboard />
                      </FeatureRoute>
                    }
                  />
                  <Route
                    path="/orders/new"
                    element={
                      <FeatureRoute feature="requests">
                        <ResponsivePage
                          desktop={<OrderCreationForm />}
                          mobile={<MobileOrderCreationForm />}
                        />
                      </FeatureRoute>
                    }
                  />
                  <Route
                    path="/orders/:orderId"
                    element={
                      <FeatureRoute feature="requests">
                        <ResponsivePage
                          desktop={<OrderDetailView />}
                          mobile={<MobileOrderDetail />}
                        />
                      </FeatureRoute>
                    }
                  />

                  {/* Requests Routes — gated by the requests feature flag. */}
                  <Route
                    path="/requests"
                    element={
                      <FeatureRoute feature="requests">
                        <RequestsDashboard />
                      </FeatureRoute>
                    }
                  />
                  <Route
                    path="/requests/new"
                    element={
                      <FeatureRoute feature="requests">
                        <ResponsivePage
                          desktop={<RequestCreationForm />}
                          mobile={<MobileRequestCreationForm />}
                        />
                      </FeatureRoute>
                    }
                  />
                  <Route
                    path="/requests/:requestId"
                    element={
                      <FeatureRoute feature="requests">
                        <ResponsivePage
                          desktop={<RequestDetailView />}
                          mobile={<MobileRequestDetail />}
                        />
                      </FeatureRoute>
                    }
                  />

                  <Route path={ROUTES.ONCALL_SCHEDULE} element={<OnCallSchedulePage />} />
                  <Route path={ROUTES.WAREHOUSES} element={<WarehousesPage />} />
                  <Route path={ROUTES.TRANSFERS} element={<TransfersPage />} />
                  <Route path={ROUTES.REPORTS} element={<ReportsPage />} />
                  <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
                  <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />

                  {/* Admin-only routes - Desktop only on mobile */}
                  <Route element={<AdminRoute />}>
                    <Route path={ROUTES.ADMIN} element={<AdminPageWrapper />} />
                    <Route path={ROUTES.MASTER_KITS} element={<MasterKitsAdmin />} />
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
