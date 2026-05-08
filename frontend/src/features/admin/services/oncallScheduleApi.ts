import { baseApi } from '@services/baseApi';
import type { OnCallUser } from './oncallApi';

export type OnCallRole = 'materials' | 'maintenance';

export interface OnCallScheduleEntry {
  id: number;
  role: OnCallRole;
  user: OnCallUser | null;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: {
    id: number;
    name: string;
    employee_number: string;
  } | null;
}

export interface OnCallScheduleListResponse {
  schedules: OnCallScheduleEntry[];
  /** Backend sets this when reading oncall_schedules failed and we degraded
   * to an empty list (typically a missing column from a pending migration). */
  schedule_unavailable?: boolean;
}

export interface OnCallScheduleListResult {
  schedules: OnCallScheduleEntry[];
  unavailable: boolean;
}

export interface OnCallScheduleQuery {
  role?: OnCallRole;
  start?: string;
  end?: string;
}

export interface CreateOnCallScheduleRequest {
  role: OnCallRole;
  user_id: number;
  start_date: string;
  end_date: string;
  notes?: string | null;
  allow_overlap?: boolean;
}

export interface UpdateOnCallScheduleRequest {
  id: number;
  role?: OnCallRole;
  user_id?: number;
  start_date?: string;
  end_date?: string;
  notes?: string | null;
  allow_overlap?: boolean;
}

const buildQuery = (params?: OnCallScheduleQuery) => {
  const search = new URLSearchParams();
  if (params?.role) search.set('role', params.role);
  if (params?.start) search.set('start', params.start);
  if (params?.end) search.set('end', params.end);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const oncallScheduleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOnCallSchedule: builder.query<OnCallScheduleListResult, OnCallScheduleQuery | void>({
      query: (params) => `/api/oncall/schedule${buildQuery(params || undefined)}`,
      transformResponse: (response: OnCallScheduleListResponse) => ({
        schedules: response.schedules,
        unavailable: response.schedule_unavailable === true,
      }),
      providesTags: ['OnCallSchedule'],
    }),
    getAdminOnCallSchedule: builder.query<OnCallScheduleListResult, OnCallScheduleQuery | void>({
      query: (params) => `/api/admin/oncall/schedule${buildQuery(params || undefined)}`,
      transformResponse: (response: OnCallScheduleListResponse) => ({
        schedules: response.schedules,
        unavailable: response.schedule_unavailable === true,
      }),
      providesTags: ['OnCallSchedule'],
    }),
    createOnCallSchedule: builder.mutation<OnCallScheduleEntry, CreateOnCallScheduleRequest>({
      query: (body) => ({
        url: '/api/admin/oncall/schedule',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['OnCallSchedule'],
    }),
    updateOnCallSchedule: builder.mutation<OnCallScheduleEntry, UpdateOnCallScheduleRequest>({
      query: ({ id, ...body }) => ({
        url: `/api/admin/oncall/schedule/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['OnCallSchedule'],
    }),
    deleteOnCallSchedule: builder.mutation<{ deleted: boolean; id: number }, number>({
      query: (id) => ({
        url: `/api/admin/oncall/schedule/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['OnCallSchedule'],
    }),
  }),
});

export const {
  useGetOnCallScheduleQuery,
  useGetAdminOnCallScheduleQuery,
  useCreateOnCallScheduleMutation,
  useUpdateOnCallScheduleMutation,
  useDeleteOnCallScheduleMutation,
} = oncallScheduleApi;
