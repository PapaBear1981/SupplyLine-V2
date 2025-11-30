import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';
import { Spin } from 'antd';
import { usePagePermission } from '../hooks/usePageAccess';
import AccessDenied from './AccessDenied';

interface PageGuardProps {
  /**
   * The permission required to access this page (e.g., 'page.tools').
   */
  permission?: string;
  /**
   * If true, only admins can access this page.
   */
  adminOnly?: boolean;
  /**
   * Custom redirect path if access is denied.
   */
  redirectTo?: string;
  /**
   * If true, shows an AccessDenied page instead of redirecting.
   * Default: true
   */
  showAccessDenied?: boolean;
  /**
   * Children to render if access is granted (used when wrapping content directly).
   */
  children?: React.ReactNode;
}

/**
 * A route guard component that protects pages based on permissions.
 *
 * @example
 * // In route configuration
 * <Route element={<PageGuard permission="page.tools" />}>
 *   <Route path="/tools" element={<ToolsPage />} />
 * </Route>
 *
 * @example
 * // Wrapping content directly
 * <PageGuard permission="page.admin_dashboard">
 *   <AdminDashboard />
 * </PageGuard>
 *
 * @example
 * // Admin-only page
 * <Route element={<PageGuard adminOnly />}>
 *   <Route path="/admin" element={<AdminPage />} />
 * </Route>
 */
export const PageGuard: React.FC<PageGuardProps> = ({
  permission,
  adminOnly = false,
  redirectTo,
  showAccessDenied = true,
  children,
}) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const hasPermission = usePagePermission(permission || '');

  // Show loading while checking auth state
  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Check admin-only access
  if (adminOnly && !user.is_admin) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    if (showAccessDenied) {
      return (
        <AccessDenied
          title="Admin Access Required"
          subTitle="This page is only accessible to administrators."
        />
      );
    }
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // Check permission-based access
  if (permission && !hasPermission) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    if (showAccessDenied) {
      return (
        <AccessDenied
          subTitle={`You don't have the required permission (${permission}) to access this page.`}
        />
      );
    }
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // Access granted - render children or Outlet
  return children ? <>{children}</> : <Outlet />;
};

export default PageGuard;
