import { useMemo } from 'react';
import { useAppSelector } from '@app/hooks';

/**
 * Hook to check if the current user has a specific permission.
 * Admins automatically have all permissions.
 *
 * @param permission - The permission name to check (e.g., 'tool.edit')
 * @returns boolean - Whether the user has the permission
 *
 * @example
 * const canEditTools = usePermission('tool.edit');
 * if (canEditTools) {
 *   // Show edit button
 * }
 */
export function usePermission(permission: string): boolean {
  const user = useAppSelector((state) => state.auth.user);

  return useMemo(() => {
    if (!user) return false;
    // Admins have all permissions
    if (user.is_admin) return true;
    // Check if user has the permission
    return user.permissions?.includes(permission) || false;
  }, [user, permission]);
}

/**
 * Hook to check if the current user has ANY of the specified permissions.
 * Admins automatically have all permissions.
 *
 * @param permissions - Array of permission names to check
 * @returns boolean - Whether the user has at least one of the permissions
 *
 * @example
 * const canManageTools = usePermissionAny(['tool.edit', 'tool.delete']);
 */
export function usePermissionAny(permissions: string[]): boolean {
  const user = useAppSelector((state) => state.auth.user);

  return useMemo(() => {
    if (!user) return false;
    // Admins have all permissions
    if (user.is_admin) return true;
    // Check if user has any of the permissions
    return permissions.some((perm) => user.permissions?.includes(perm));
  }, [user, permissions]);
}

/**
 * Hook to check if the current user has ALL of the specified permissions.
 * Admins automatically have all permissions.
 *
 * @param permissions - Array of permission names to check
 * @returns boolean - Whether the user has all of the permissions
 *
 * @example
 * const canFullyManageTools = usePermissionAll(['tool.view', 'tool.edit', 'tool.delete']);
 */
export function usePermissionAll(permissions: string[]): boolean {
  const user = useAppSelector((state) => state.auth.user);

  return useMemo(() => {
    if (!user) return false;
    // Admins have all permissions
    if (user.is_admin) return true;
    // Check if user has all of the permissions
    return permissions.every((perm) => user.permissions?.includes(perm));
  }, [user, permissions]);
}

/**
 * Hook to get all permissions for the current user.
 *
 * @returns string[] - Array of permission names the user has
 *
 * @example
 * const permissions = usePermissions();
 * console.log('User has these permissions:', permissions);
 */
export function usePermissions(): string[] {
  const user = useAppSelector((state) => state.auth.user);

  return useMemo(() => {
    if (!user) return [];
    return user.permissions || [];
  }, [user]);
}

/**
 * Hook to check if the current user is an admin.
 *
 * @returns boolean - Whether the user is an admin
 *
 * @example
 * const isAdmin = useIsAdmin();
 * if (isAdmin) {
 *   // Show admin-only features
 * }
 */
export function useIsAdmin(): boolean {
  const user = useAppSelector((state) => state.auth.user);

  return useMemo(() => {
    return user?.is_admin || false;
  }, [user]);
}
