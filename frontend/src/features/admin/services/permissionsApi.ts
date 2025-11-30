import { baseApi } from '@services/baseApi';
import type { Permission, PermissionCategory, UserPermission, UserRole } from '@features/users/types';

export interface RoleWithPermissions extends UserRole {
  permissions: Permission[];
}

export interface UserPermissionsResponse {
  user_id: number;
  user_name: string;
  is_admin: boolean;
  effective_permissions: string[];
  role_permissions: string[];
  user_specific_permissions: UserPermission[];
  roles: UserRole[];
}

export interface AddUserPermissionRequest {
  user_id: number;
  permission_id: number;
  grant_type: 'grant' | 'deny';
  reason?: string;
  expires_at?: string;
}

export interface BulkUpdatePermissionsRequest {
  user_id: number;
  permissions: Array<{
    permission_id: number;
    grant_type: 'grant' | 'deny';
    reason?: string;
    expires_at?: string;
  }>;
  replace?: boolean;
}

export interface PermissionMatrixResponse {
  roles: UserRole[];
  permissions: Permission[];
  assignments: Record<number, number[]>;
}

export const permissionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get all permissions (optionally grouped by category)
    getPermissions: builder.query<Permission[], { grouped?: boolean }>({
      query: ({ grouped = false }) => `/api/permissions${grouped ? '?grouped=true' : ''}`,
      providesTags: ['Permission'],
    }),

    // Get permissions organized by category
    getPermissionCategories: builder.query<PermissionCategory[], void>({
      query: () => '/api/permissions/categories',
      providesTags: ['Permission'],
    }),

    // Search permissions
    searchPermissions: builder.query<Permission[], { q?: string; category?: string }>({
      query: ({ q, category }) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (category) params.set('category', category);
        return `/api/permissions/search?${params.toString()}`;
      },
      providesTags: ['Permission'],
    }),

    // Get permission matrix (roles vs permissions)
    getPermissionMatrix: builder.query<PermissionMatrixResponse, void>({
      query: () => '/api/permissions/matrix',
      providesTags: ['Permission', 'Role'],
    }),

    // Get role with permissions
    getRoleWithPermissions: builder.query<RoleWithPermissions, number>({
      query: (roleId) => `/api/roles/${roleId}`,
      providesTags: (_result, _error, id) => [{ type: 'Role', id }],
    }),

    // Update role permissions
    updateRolePermissions: builder.mutation<RoleWithPermissions, { roleId: number; permissions: number[] }>({
      query: ({ roleId, permissions }) => ({
        url: `/api/roles/${roleId}`,
        method: 'PUT',
        body: { permissions },
      }),
      invalidatesTags: (_result, _error, { roleId }) => [
        { type: 'Role', id: roleId },
        'Permission',
      ],
    }),

    // Get user permissions (detailed)
    getUserPermissions: builder.query<UserPermissionsResponse, number>({
      query: (userId) => `/api/users/${userId}/permissions`,
      providesTags: (_result, _error, id) => [{ type: 'User', id }, 'Permission'],
    }),

    // Add/update user-specific permission
    addUserPermission: builder.mutation<{ message: string; effective_permissions: string[] }, AddUserPermissionRequest>({
      query: ({ user_id, ...body }) => ({
        url: `/api/users/${user_id}/permissions`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { user_id }) => [{ type: 'User', id: user_id }, 'Permission'],
    }),

    // Remove user-specific permission
    removeUserPermission: builder.mutation<{ message: string; effective_permissions: string[] }, { user_id: number; permission_id: number }>({
      query: ({ user_id, permission_id }) => ({
        url: `/api/users/${user_id}/permissions/${permission_id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { user_id }) => [{ type: 'User', id: user_id }, 'Permission'],
    }),

    // Bulk update user permissions
    bulkUpdateUserPermissions: builder.mutation<{ message: string; added: number; updated: number; errors?: string[]; effective_permissions: string[] }, BulkUpdatePermissionsRequest>({
      query: ({ user_id, ...body }) => ({
        url: `/api/users/${user_id}/permissions/bulk`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { user_id }) => [{ type: 'User', id: user_id }, 'Permission'],
    }),

    // Get current user's permissions
    getMyPermissions: builder.query<{
      user_id: number;
      is_admin: boolean;
      permissions: string[];
      roles: UserRole[];
    }, void>({
      query: () => '/api/auth/my-permissions',
      providesTags: ['Permission'],
    }),
  }),
});

export const {
  useGetPermissionsQuery,
  useGetPermissionCategoriesQuery,
  useSearchPermissionsQuery,
  useGetPermissionMatrixQuery,
  useGetRoleWithPermissionsQuery,
  useUpdateRolePermissionsMutation,
  useGetUserPermissionsQuery,
  useAddUserPermissionMutation,
  useRemoveUserPermissionMutation,
  useBulkUpdateUserPermissionsMutation,
  useGetMyPermissionsQuery,
} = permissionsApi;
