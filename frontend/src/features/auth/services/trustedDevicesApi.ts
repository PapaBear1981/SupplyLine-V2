import { baseApi } from '@services/baseApi';
import type {
  RevokeAllTrustedDevicesResponse,
  TrustedDeviceListResponse,
} from '../types';

export const trustedDevicesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listTrustedDevices: builder.query<TrustedDeviceListResponse, void>({
      query: () => '/api/auth/trusted-devices',
      providesTags: ['TrustedDevice'],
    }),
    revokeTrustedDevice: builder.mutation<{ message: string }, number>({
      query: (id) => ({
        url: `/api/auth/trusted-devices/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['TrustedDevice'],
    }),
    revokeAllTrustedDevices: builder.mutation<RevokeAllTrustedDevicesResponse, void>({
      query: () => ({
        url: '/api/auth/trusted-devices',
        method: 'DELETE',
      }),
      invalidatesTags: ['TrustedDevice'],
    }),
  }),
});

export const {
  useListTrustedDevicesQuery,
  useRevokeTrustedDeviceMutation,
  useRevokeAllTrustedDevicesMutation,
} = trustedDevicesApi;
