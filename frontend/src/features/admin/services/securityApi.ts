import { baseApi } from '@services/baseApi';

export interface SecuritySettings {
  session_timeout_minutes: number;
  default_timeout_minutes: number;
  min_timeout_minutes: number;
  max_timeout_minutes: number;
  source: 'database' | 'config';
  updated_at: string | null;
  updated_by: {
    id: number;
    name: string;
    employee_number: string;
  } | null;
}

export interface UpdateSecuritySettingsRequest {
  session_timeout_minutes: number;
}

export const securityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSecuritySettings: builder.query<SecuritySettings, void>({
      query: () => '/api/security/settings',
      providesTags: ['SystemSettings'],
    }),
    updateSecuritySettings: builder.mutation<SecuritySettings, UpdateSecuritySettingsRequest>({
      query: (body) => ({
        url: '/api/security/settings',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['SystemSettings'],
    }),
  }),
});

export const { useGetSecuritySettingsQuery, useUpdateSecuritySettingsMutation } = securityApi;
