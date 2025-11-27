import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { MainLayout } from '@shared/components/layouts/MainLayout';
import { AuthLayout } from '@shared/components/layouts/AuthLayout';
import { ProtectedRoute } from '@features/auth/components/ProtectedRoute';
import { LoginPage } from '@features/auth/pages/LoginPage';
import { DashboardPage } from '@features/dashboard/pages/DashboardPage';
import { ToolsPage } from '@features/tools/pages/ToolsPage';
import { ChemicalsPage } from '@features/chemicals/pages/ChemicalsPage';
import { SettingsPage } from '@features/settings/pages/SettingsPage';
import { ProfilePage } from '@features/profile/pages/ProfilePage';
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
              <Route path={ROUTES.TOOLS} element={<ToolsPage />} />
              <Route path={ROUTES.CHEMICALS} element={<ChemicalsPage />} />
              <Route path={ROUTES.KITS} element={<div>Kits Page (Coming Soon)</div>} />
              <Route path={ROUTES.WAREHOUSES} element={<div>Warehouses Page (Coming Soon)</div>} />
              <Route path={ROUTES.REPORTS} element={<div>Reports Page (Coming Soon)</div>} />
              <Route path={ROUTES.USERS} element={<div>Users Page (Coming Soon)</div>} />
              <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
              <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
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
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
