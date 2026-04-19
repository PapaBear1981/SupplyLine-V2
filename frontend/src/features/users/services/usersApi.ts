import { baseApi } from '@services/baseApi';
import type {
  CreateUserRequest,
  Department,
  User,
  UserFormValues,
  UserListResponse,
  UserRole,
  UsersQueryParams,
} from '../types';

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<UserListResponse, UsersQueryParams | void>({
      query: (params) => ({
        url: '/api/users',
        params: params?.q ? { q: params.q } : undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'User' as const, id })),
              { type: 'User' as const, id: 'LIST' },
            ]
          : [{ type: 'User' as const, id: 'LIST' }],
    }),

    getUser: builder.query<User, number>({
      query: (id) => `/api/users/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'User' as const, id }],
    }),

    createUser: builder.mutation<User, CreateUserRequest>({
      query: (body) => ({
        url: '/api/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'User' as const, id: 'LIST' }],
    }),

    updateUser: builder.mutation<User, { id: number; data: Partial<UserFormValues> }>({
      query: ({ id, data }) => ({
        url: `/api/users/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'User' as const, id },
        { type: 'User' as const, id: 'LIST' },
      ],
    }),

    deleteUser: builder.mutation<{ message?: string }, number>({
      query: (id) => ({
        url: `/api/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'User' as const, id: 'LIST' }],
    }),

    unlockUser: builder.mutation<User, number>({
      query: (id) => ({
        url: `/api/users/${id}/unlock`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'User' as const, id },
        { type: 'User' as const, id: 'LIST' },
      ],
    }),

    getDepartments: builder.query<Department[], void>({
      query: () => ({
        url: '/api/departments',
        params: { include_inactive: true },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Department' as const, id })),
              { type: 'Department' as const, id: 'LIST' },
            ]
          : [{ type: 'Department' as const, id: 'LIST' }],
    }),

    getRoles: builder.query<UserRole[], void>({
      query: () => '/api/roles',
      providesTags: ['Role'],
    }),

    assignUserRoles: builder.mutation<User, { userId: number; role_ids: number[] }>({
      query: ({ userId, role_ids }) => ({
        url: `/api/users/${userId}/roles`,
        method: 'PUT',
        body: { role_ids },
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'User' as const, id: userId },
        { type: 'User' as const, id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useLazyGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useUnlockUserMutation,
  useGetDepartmentsQuery,
  useGetRolesQuery,
  useAssignUserRolesMutation,
} = usersApi;
