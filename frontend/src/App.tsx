import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { MainLayout } from '@shared/components/layouts/MainLayout';
import { AuthLayout } from '@shared/components/layouts/AuthLayout';
import { ProtectedRoute } from '@features/auth/components/ProtectedRoute';
import { LoginPage } from '@features/auth/pages/LoginPage';
import { DashboardPage } from '@features/dashboard/pages/DashboardPage';
import { ROUTES } from '@shared/constants/routes';

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
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
              <Route path={ROUTES.TOOLS} element={<div>Tools Page (Coming Soon)</div>} />
              <Route path={ROUTES.CHEMICALS} element={<div>Chemicals Page (Coming Soon)</div>} />
              <Route path={ROUTES.KITS} element={<div>Kits Page (Coming Soon)</div>} />
              <Route path={ROUTES.WAREHOUSES} element={<div>Warehouses Page (Coming Soon)</div>} />
              <Route path={ROUTES.REPORTS} element={<div>Reports Page (Coming Soon)</div>} />
              <Route path={ROUTES.USERS} element={<div>Users Page (Coming Soon)</div>} />
              <Route path={ROUTES.PROFILE} element={<div>Profile Page (Coming Soon)</div>} />
            </Route>
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
