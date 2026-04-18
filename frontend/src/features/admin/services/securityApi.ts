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

/**
 * Public read of the mobile admin toggle. This is returned from the
 * broadly-readable `GET /api/mobile/settings` endpoint so the payload
 * deliberately omits updater PII (see _serialize_mobile_settings_public
 * in backend/routes_security.py).
 */
export interface MobileSettings {
  mobile_admin_enabled: boolean;
  source: 'database' | 'config';
}

/**
 * Admin-only response returned from the permission-gated
 * `PUT /api/mobile/settings` endpoint. Includes updater metadata so
 * the desktop System Settings UI can show who last flipped the switch.
 */
export interface MobileSettingsAdmin extends MobileSettings {
  updated_at: string | null;
  updated_by: {
    id: number;
    name: string;
    employee_number: string;
  } | null;
}

export interface UpdateMobileSettingsRequest {
  mobile_admin_enabled: boolean;
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
    getMobileSettings: builder.query<MobileSettings, void>({
      query: () => '/api/mobile/settings',
      providesTags: ['SystemSettings'],
    }),
    updateMobileSettings: builder.mutation<MobileSettingsAdmin, UpdateMobileSettingsRequest>({
      query: (body) => ({
        url: '/api/mobile/settings',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['SystemSettings'],
    }),
  }),
});

export const {
  useGetSecuritySettingsQuery,
  useUpdateSecuritySettingsMutation,
  useGetMobileSettingsQuery,
  useUpdateMobileSettingsMutation,
} = securityApi;
