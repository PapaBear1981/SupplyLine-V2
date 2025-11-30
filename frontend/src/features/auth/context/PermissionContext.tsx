import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useAppSelector } from '@app/hooks';

interface PermissionContextValue {
  permissions: string[];
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasPageAccess: (pagePermission: string) => boolean;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAppSelector((state) => state.auth.user);

  const permissions = useMemo(() => {
    if (!user) return [];
    return user.permissions || [];
  }, [user]);

  const isAdmin = useMemo(() => {
    return user?.is_admin || false;
  }, [user]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      // Admins have all permissions
      if (isAdmin) return true;
      return permissions.includes(permission);
    },
    [permissions, isAdmin]
  );

  const hasAnyPermission = useCallback(
    (requiredPermissions: string[]): boolean => {
      // Admins have all permissions
      if (isAdmin) return true;
      return requiredPermissions.some((perm) => permissions.includes(perm));
    },
    [permissions, isAdmin]
  );

  const hasAllPermissions = useCallback(
    (requiredPermissions: string[]): boolean => {
      // Admins have all permissions
      if (isAdmin) return true;
      return requiredPermissions.every((perm) => permissions.includes(perm));
    },
    [permissions, isAdmin]
  );

  const hasPageAccess = useCallback(
    (pagePermission: string): boolean => {
      // Admins have all permissions
      if (isAdmin) return true;
      // Check if user has the page access permission
      return permissions.includes(pagePermission);
    },
    [permissions, isAdmin]
  );

  const value = useMemo(
    () => ({
      permissions,
      isAdmin,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasPageAccess,
    }),
    [permissions, isAdmin, hasPermission, hasAnyPermission, hasAllPermissions, hasPageAccess]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePermissionContext = (): PermissionContextValue => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissionContext must be used within a PermissionProvider');
  }
  return context;
};

export default PermissionContext;
