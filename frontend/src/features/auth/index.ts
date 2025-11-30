// Components
export { ProtectedRoute } from './components/ProtectedRoute';
export { AdminRoute } from './components/AdminRoute';
export { PermissionGuard } from './components/PermissionGuard';
export { PageGuard } from './components/PageGuard';
export { AccessDenied } from './components/AccessDenied';

// Context
export { PermissionProvider, usePermissionContext } from './context/PermissionContext';

// Hooks
export {
  usePermission,
  usePermissionAny,
  usePermissionAll,
  usePermissions,
  useIsAdmin,
} from './hooks/usePermission';

export {
  usePageAccess,
  usePagePermission,
  useAccessiblePages,
  PAGE_PERMISSIONS,
  PUBLIC_PAGES,
} from './hooks/usePageAccess';

// Slices
export { setCredentials, logout } from './slices/authSlice';

// Types
export type { AuthState, User, LoginRequest, LoginResponse } from './types';
