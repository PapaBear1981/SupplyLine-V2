import { baseApi } from '@services/baseApi';
import type { User } from '@features/auth/types';
import type { UpdateProfileRequest, ChangePasswordRequest, ProfileStats } from '../types';

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    updateProfile: builder.mutation<User, UpdateProfileRequest>({
      query: (data) => ({
        url: '/api/profile',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),
    changePassword: builder.mutation<void, ChangePasswordRequest>({
      query: (data) => ({
        url: '/api/profile/password',
        method: 'PUT',
        body: data,
      }),
    }),
    getProfileStats: builder.query<ProfileStats, void>({
      query: () => '/api/profile/stats',
    }),
    uploadAvatar: builder.mutation<{ avatar_url: string }, FormData>({
      query: (formData) => ({
        url: '/api/profile/avatar',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useGetProfileStatsQuery,
  useUploadAvatarMutation,
} = profileApi;
