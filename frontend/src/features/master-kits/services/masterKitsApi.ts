import { baseApi } from '@services/baseApi';
import type {
  MasterKit,
  MasterKitBox,
  MasterKitEntry,
  KitComplianceReport,
} from '../../kits/types';

interface ListMasterKitsResponse {
  master_kits: MasterKit[];
}

interface CreateMasterKitBody {
  aircraft_type_id: number;
  name: string;
  description?: string;
  is_active?: boolean;
}

interface CreateMasterKitBoxBody {
  box_number: string;
  box_type: string;
  description?: string;
  sort_order?: number;
}

interface CreateMasterKitEntryBody {
  master_box_id: number;
  entry_type: 'tool' | 'chemical' | 'expendable';
  ref_tool_id?: number | null;
  ref_chemical_part_id?: number | null;
  part_number?: string;
  description?: string;
  required_quantity?: number;
  minimum_stock_level?: number | null;
  unit?: string;
  tracking_type?: 'lot' | 'serial' | null;
  is_required?: boolean;
  notes?: string;
  sort_order?: number;
}

export const masterKitsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMasterKits: builder.query<ListMasterKitsResponse, { aircraft_type_id?: number; is_active?: boolean } | void>({
      query: (params) => ({
        url: '/api/master-kits',
        params: params || undefined,
      }),
      providesTags: ['MasterKit'],
    }),

    getMasterKit: builder.query<MasterKit, number>({
      query: (id) => `/api/master-kits/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'MasterKit', id }],
    }),

    createMasterKit: builder.mutation<MasterKit, CreateMasterKitBody>({
      query: (body) => ({ url: '/api/master-kits', method: 'POST', body }),
      invalidatesTags: ['MasterKit'],
    }),

    updateMasterKit: builder.mutation<
      MasterKit,
      { id: number; data: Partial<CreateMasterKitBody> }
    >({
      query: ({ id, data }) => ({ url: `/api/master-kits/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { id }) => ['MasterKit', { type: 'MasterKit', id }],
    }),

    deleteMasterKit: builder.mutation<{ message: string }, number>({
      query: (id) => ({ url: `/api/master-kits/${id}`, method: 'DELETE' }),
      invalidatesTags: ['MasterKit'],
    }),

    createMasterKitBox: builder.mutation<
      MasterKitBox,
      { master_kit_id: number; data: CreateMasterKitBoxBody }
    >({
      query: ({ master_kit_id, data }) => ({
        url: `/api/master-kits/${master_kit_id}/boxes`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_r, _e, { master_kit_id }) => [
        'MasterKit',
        { type: 'MasterKit', id: master_kit_id },
      ],
    }),

    updateMasterKitBox: builder.mutation<
      MasterKitBox,
      { id: number; data: Partial<CreateMasterKitBoxBody>; master_kit_id: number }
    >({
      query: ({ id, data }) => ({ url: `/api/master-kits/boxes/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { master_kit_id }) => [
        'MasterKit',
        { type: 'MasterKit', id: master_kit_id },
      ],
    }),

    deleteMasterKitBox: builder.mutation<
      { message: string },
      { id: number; master_kit_id: number }
    >({
      query: ({ id }) => ({ url: `/api/master-kits/boxes/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { master_kit_id }) => [
        'MasterKit',
        { type: 'MasterKit', id: master_kit_id },
      ],
    }),

    createMasterKitEntry: builder.mutation<
      MasterKitEntry,
      { master_kit_id: number; data: CreateMasterKitEntryBody }
    >({
      query: ({ master_kit_id, data }) => ({
        url: `/api/master-kits/${master_kit_id}/entries`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_r, _e, { master_kit_id }) => [
        'MasterKit',
        { type: 'MasterKit', id: master_kit_id },
      ],
    }),

    updateMasterKitEntry: builder.mutation<
      MasterKitEntry,
      { id: number; data: Partial<CreateMasterKitEntryBody>; master_kit_id: number }
    >({
      query: ({ id, data }) => ({ url: `/api/master-kits/entries/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_r, _e, { master_kit_id }) => [
        'MasterKit',
        { type: 'MasterKit', id: master_kit_id },
      ],
    }),

    deleteMasterKitEntry: builder.mutation<
      { message: string },
      { id: number; master_kit_id: number }
    >({
      query: ({ id }) => ({ url: `/api/master-kits/entries/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { master_kit_id }) => [
        'MasterKit',
        { type: 'MasterKit', id: master_kit_id },
      ],
    }),

    getKitCompliance: builder.query<KitComplianceReport, number>({
      query: (kitId) => `/api/kits/${kitId}/compliance`,
      providesTags: (_r, _e, kitId) => [{ type: 'Kit', id: kitId }, 'MasterKit'],
    }),

    syncKitFromMaster: builder.mutation<{ message: string }, { kitId: number; force?: boolean }>({
      query: ({ kitId, force }) => ({
        url: `/api/kits/${kitId}/sync-from-master${force ? '?force=true' : ''}`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { kitId }) => [{ type: 'Kit', id: kitId }, 'MasterKit'],
    }),

    getMasterKitForAircraftType: builder.query<{ master_kit: MasterKit | null }, number>({
      query: (aircraftTypeId) => `/api/aircraft-types/${aircraftTypeId}/master-kit`,
      providesTags: ['MasterKit'],
    }),
  }),
});

export const {
  useListMasterKitsQuery,
  useGetMasterKitQuery,
  useCreateMasterKitMutation,
  useUpdateMasterKitMutation,
  useDeleteMasterKitMutation,
  useCreateMasterKitBoxMutation,
  useUpdateMasterKitBoxMutation,
  useDeleteMasterKitBoxMutation,
  useCreateMasterKitEntryMutation,
  useUpdateMasterKitEntryMutation,
  useDeleteMasterKitEntryMutation,
  useGetKitComplianceQuery,
  useSyncKitFromMasterMutation,
  useGetMasterKitForAircraftTypeQuery,
} = masterKitsApi;
