import { useMemo } from 'react';
import { useAppSelector } from '@app/hooks';

/**
 * Page permission mapping - maps page routes to their required permissions.
 * This is used by both the page guards and the sidebar navigation.
 */
export const PAGE_PERMISSIONS: Record<string, string> = {
  // Main pages
  '/dashboard': 'page.dashboard',
  '/tools': 'page.tools',
  '/tool-checkout': 'page.checkouts',
  '/chemicals': 'page.chemicals',
  '/kits': 'page.kits',
  '/warehouses': 'page.warehouses',
  '/reports': 'page.reports',
  '/orders': 'page.orders',
  '/requests': 'page.requests',
  '/users': 'page.users',
  '/profile': 'page.profile',
  '/settings': 'page.settings',
  '/admin': 'page.admin_dashboard',
  // Additional pages can be added here
};

/**
 * Pages that don't require any special permissions (available to all authenticated users).
 */
export const PUBLIC_PAGES = ['/dashboard', '/profile'];

/**
 * Hook to check if the current user has access to a specific page.
 *
 * @param pagePath - The page path to check (e.g., '/tools', '/admin')
 * @returns boolean - Whether the user has access to the page
 *
 * @example
 * const canAccessTools = usePageAccess('/tools');
 * if (!canAccessTools) {
 *   return <Navigate to="/dashboard" />;
 * }
 */
export function usePageAccess(pagePath: string): boolean {
  const user = useAppSelector((state) => state.auth.user);

  return useMemo(() => {
    if (!user) return false;

    // Admins have access to all pages
    if (user.is_admin) return true;

    // Public pages are accessible to all authenticated users
    if (PUBLIC_PAGES.includes(pagePath)) return true;

    // Check if page requires a specific permission
    const requiredPermission = PAGE_PERMISSIONS[pagePath];
    if (!requiredPermission) {
      // If no permission is defined for the page, allow access by default
      return true;
    }

    // Check if user has the required permission
    return user.permissions?.includes(requiredPermission) || false;
  }, [user, pagePath]);
}

/**
 * Hook to check if the current user has access to a page based on permission name.
 *
 * @param pagePermission - The page permission to check (e.g., 'page.tools')
 * @returns boolean - Whether the user has the page permission
 *
 * @example
 * const canAccessTools = usePagePermission('page.tools');
 */
export function usePagePermission(pagePermission: string): boolean {
  const user = useAppSelector((state) => state.auth.user);

  return useMemo(() => {
    if (!user) return false;
    // Admins have access to all pages
    if (user.is_admin) return true;
    // Check if user has the page permission
    return user.permissions?.includes(pagePermission) || false;
  }, [user, pagePermission]);
}

/**
 * Hook to get all accessible pages for the current user.
 *
 * @returns string[] - Array of page paths the user can access
 *
 * @example
 * const accessiblePages = useAccessiblePages();
 * const filteredNavItems = navItems.filter(item => accessiblePages.includes(item.path));
 */
export function useAccessiblePages(): string[] {
  const user = useAppSelector((state) => state.auth.user);

  return useMemo(() => {
    if (!user) return [];

    // Admins have access to all pages
    if (user.is_admin) return Object.keys(PAGE_PERMISSIONS);

    const userPermissions = user.permissions || [];
    const accessiblePages: string[] = [...PUBLIC_PAGES];

    // Add pages the user has permission to access
    for (const [path, permission] of Object.entries(PAGE_PERMISSIONS)) {
      if (userPermissions.includes(permission) && !accessiblePages.includes(path)) {
        accessiblePages.push(path);
      }
    }

    return accessiblePages;
  }, [user]);
}
