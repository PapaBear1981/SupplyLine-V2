import { baseApi } from '@services/baseApi';
import type {
  LoginRequest,
  LoginResponse,
  TotpStatusResponse,
  TotpSetupResponse,
  TotpVerifySetupRequest,
  TotpVerifySetupResponse,
  TotpVerifyRequest,
  TotpVerifyResponse,
  TotpDisableRequest,
  TotpDisableResponse,
} from '../types';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/api/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/api/auth/logout',
        method: 'POST',
      }),
    }),
    getCurrentUser: builder.query<LoginResponse['user'], void>({
      query: () => '/api/auth/me',
      transformResponse: (response: { user: LoginResponse['user'] }) => response.user,
      providesTags: ['User'],
    }),
    // TOTP Two-Factor Authentication endpoints
    getTotpStatus: builder.query<TotpStatusResponse, void>({
      query: () => '/api/auth/totp/status',
      providesTags: ['User'],
    }),
    setupTotp: builder.mutation<TotpSetupResponse, void>({
      query: () => ({
        url: '/api/auth/totp/setup',
        method: 'POST',
      }),
    }),
    verifyTotpSetup: builder.mutation<TotpVerifySetupResponse, TotpVerifySetupRequest>({
      query: (data) => ({
        url: '/api/auth/totp/verify-setup',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),
    verifyTotp: builder.mutation<TotpVerifyResponse, TotpVerifyRequest>({
      query: (data) => ({
        url: '/api/auth/totp/verify',
        method: 'POST',
        body: data,
      }),
    }),
    disableTotp: builder.mutation<TotpDisableResponse, TotpDisableRequest>({
      query: (data) => ({
        url: '/api/auth/totp/disable',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useGetTotpStatusQuery,
  useSetupTotpMutation,
  useVerifyTotpSetupMutation,
  useVerifyTotpMutation,
  useDisableTotpMutation,
} = authApi;
