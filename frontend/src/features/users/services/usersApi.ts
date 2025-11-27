import { baseApi } from '@services/baseApi';
import type {
  CreateUserRequest,
  Department,
  User,
  UserFormValues,
  UserListResponse,
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
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useUnlockUserMutation,
  useGetDepartmentsQuery,
} = usersApi;
