import React from 'react';
import { usePermission, usePermissionAny, usePermissionAll, useIsAdmin } from '../hooks/usePermission';

interface PermissionGuardProps {
  children: React.ReactNode;
  /**
   * Single permission to check.
   */
  permission?: string;
  /**
   * Multiple permissions - user must have at least one.
   */
  anyOf?: string[];
  /**
   * Multiple permissions - user must have all of them.
   */
  allOf?: string[];
  /**
   * Fallback content to render if permission check fails.
   * If not provided, nothing will be rendered.
   */
  fallback?: React.ReactNode;
  /**
   * If true, only admins can see the content.
   */
  adminOnly?: boolean;
}

/**
 * A guard component that conditionally renders children based on user permissions.
 *
 * @example
 * // Single permission
 * <PermissionGuard permission="tool.edit">
 *   <EditButton />
 * </PermissionGuard>
 *
 * @example
 * // Any of multiple permissions
 * <PermissionGuard anyOf={['tool.edit', 'tool.delete']}>
 *   <ManageToolsSection />
 * </PermissionGuard>
 *
 * @example
 * // All of multiple permissions
 * <PermissionGuard allOf={['tool.view', 'tool.edit', 'tool.delete']}>
 *   <FullToolManagement />
 * </PermissionGuard>
 *
 * @example
 * // With fallback
 * <PermissionGuard permission="tool.edit" fallback={<ViewOnlyMessage />}>
 *   <EditForm />
 * </PermissionGuard>
 *
 * @example
 * // Admin only
 * <PermissionGuard adminOnly>
 *   <AdminPanel />
 * </PermissionGuard>
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  anyOf,
  allOf,
  fallback = null,
  adminOnly = false,
}) => {
  const isAdmin = useIsAdmin();
  const hasSinglePermission = usePermission(permission || '');
  const hasAnyPermission = usePermissionAny(anyOf || []);
  const hasAllPermissions = usePermissionAll(allOf || []);

  // Admin-only check
  if (adminOnly) {
    return isAdmin ? <>{children}</> : <>{fallback}</>;
  }

  // Single permission check
  if (permission) {
    return hasSinglePermission ? <>{children}</> : <>{fallback}</>;
  }

  // Any of permissions check
  if (anyOf && anyOf.length > 0) {
    return hasAnyPermission ? <>{children}</> : <>{fallback}</>;
  }

  // All of permissions check
  if (allOf && allOf.length > 0) {
    return hasAllPermissions ? <>{children}</> : <>{fallback}</>;
  }

  // No permission requirement specified, render children
  return <>{children}</>;
};

export default PermissionGuard;
