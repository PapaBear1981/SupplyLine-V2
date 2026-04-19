import { baseApi } from '@services/baseApi';

export interface OnCallUser {
  id: number;
  name: string;
  employee_number: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
}

export interface OnCallEntry {
  user: OnCallUser | null;
  updated_at: string | null;
  updated_by: {
    id: number;
    name: string;
    employee_number: string;
  } | null;
}

export interface OnCallPersonnel {
  materials: OnCallEntry;
  maintenance: OnCallEntry;
}

export interface UpdateOnCallRequest {
  materials_user_id?: number | null;
  maintenance_user_id?: number | null;
}

export const oncallApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOnCallPersonnel: builder.query<OnCallPersonnel, void>({
      query: () => '/api/oncall',
      providesTags: ['OnCall'],
    }),
    getAdminOnCallPersonnel: builder.query<OnCallPersonnel, void>({
      query: () => '/api/admin/oncall',
      providesTags: ['OnCall'],
    }),
    updateOnCallPersonnel: builder.mutation<OnCallPersonnel, UpdateOnCallRequest>({
      query: (body) => ({
        url: '/api/admin/oncall',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['OnCall'],
    }),
  }),
});

export const {
  useGetOnCallPersonnelQuery,
  useGetAdminOnCallPersonnelQuery,
  useUpdateOnCallPersonnelMutation,
} = oncallApi;
