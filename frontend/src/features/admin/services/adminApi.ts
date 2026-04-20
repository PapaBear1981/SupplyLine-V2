import { baseApi } from '@services/baseApi';
import type {
  Announcement,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  ResetPasswordRequest,
  UpdateUserPermissionsRequest,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  AdminStats,
  Department,
  UserRole,
  OnlineUsersResponse,
  BugReport,
  CreateBugReportRequest,
  UpdateBugReportRequest,
  GitHubSettings,
  UpdateGitHubSettingsRequest,
} from '../types';

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Admin Stats
    getAdminStats: builder.query<AdminStats, void>({
      query: () => '/api/admin/stats',
      providesTags: ['User', 'Department'],
    }),

    // Online Users (available to all authenticated users)
    getOnlineUsers: builder.query<OnlineUsersResponse, void>({
      query: () => '/api/users/online',
    }),

    // Announcements
    getAnnouncements: builder.query<Announcement[], void>({
      query: () => '/api/admin/announcements',
      providesTags: ['Announcement'],
    }),
    createAnnouncement: builder.mutation<Announcement, CreateAnnouncementRequest>({
      query: (body) => ({
        url: '/api/admin/announcements',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Announcement'],
    }),
    updateAnnouncement: builder.mutation<Announcement, UpdateAnnouncementRequest>({
      query: ({ id, ...body }) => ({
        url: `/api/admin/announcements/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Announcement'],
    }),
    deleteAnnouncement: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/admin/announcements/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Announcement'],
    }),

    // User Management
    resetUserPassword: builder.mutation<{ message: string }, ResetPasswordRequest>({
      query: (body) => ({
        url: '/api/admin/users/reset-password',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),
    toggleUserStatus: builder.mutation<{ message: string }, { user_id: number; is_active: boolean }>({
      query: (body) => ({
        url: '/api/admin/users/toggle-status',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),
    unlockUser: builder.mutation<{ message: string }, number>({
      query: (user_id) => ({
        url: '/api/admin/users/unlock',
        method: 'POST',
        body: { user_id },
      }),
      invalidatesTags: ['User'],
    }),
    updateUserPermissions: builder.mutation<{ message: string }, UpdateUserPermissionsRequest>({
      query: (body) => ({
        url: '/api/admin/users/permissions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),

    // Department Management
    getDepartments: builder.query<Department[], void>({
      query: () => '/api/admin/departments',
      providesTags: ['Department'],
    }),
    createDepartment: builder.mutation<Department, CreateDepartmentRequest>({
      query: (body) => ({
        url: '/api/admin/departments',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Department'],
    }),
    updateDepartment: builder.mutation<Department, UpdateDepartmentRequest>({
      query: ({ id, ...body }) => ({
        url: `/api/admin/departments/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Department'],
    }),
    deleteDepartment: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/admin/departments/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Department'],
    }),

    // Role Management
    getRoles: builder.query<UserRole[], void>({
      query: () => '/api/admin/roles',
      providesTags: ['Role'],
    }),
    createRole: builder.mutation<UserRole, CreateRoleRequest>({
      query: (body) => ({
        url: '/api/admin/roles',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Role'],
    }),
    updateRole: builder.mutation<UserRole, UpdateRoleRequest>({
      query: ({ id, ...body }) => ({
        url: `/api/admin/roles/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Role'],
    }),
    deleteRole: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/admin/roles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Role'],
    }),

    // Bug Reports
    getBugReports: builder.query<BugReport[], { status?: string; severity?: string } | void>({
      query: (params) => {
        const search = new URLSearchParams();
        if (params?.status) search.append('status', params.status);
        if (params?.severity) search.append('severity', params.severity);
        const qs = search.toString();
        return `/api/bug-reports${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['BugReport'],
    }),

    createBugReport: builder.mutation<BugReport, CreateBugReportRequest>({
      query: (body) => ({
        url: '/api/bug-reports',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BugReport'],
    }),

    updateBugReport: builder.mutation<BugReport, UpdateBugReportRequest>({
      query: ({ id, ...body }) => ({
        url: `/api/bug-reports/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['BugReport'],
    }),

    deleteBugReport: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/bug-reports/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['BugReport'],
    }),

    // GitHub Settings
    getGitHubSettings: builder.query<GitHubSettings, void>({
      query: () => '/api/github/settings',
      providesTags: ['GitHubSettings'],
    }),

    updateGitHubSettings: builder.mutation<GitHubSettings, UpdateGitHubSettingsRequest>({
      query: (body) => ({
        url: '/api/github/settings',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['GitHubSettings'],
    }),
  }),
});

export const {
  useGetAdminStatsQuery,
  useGetOnlineUsersQuery,
  useGetAnnouncementsQuery,
  useCreateAnnouncementMutation,
  useUpdateAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useResetUserPasswordMutation,
  useToggleUserStatusMutation,
  useUnlockUserMutation,
  useUpdateUserPermissionsMutation,
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetBugReportsQuery,
  useCreateBugReportMutation,
  useUpdateBugReportMutation,
  useDeleteBugReportMutation,
  useGetGitHubSettingsQuery,
  useUpdateGitHubSettingsMutation,
} = adminApi;
