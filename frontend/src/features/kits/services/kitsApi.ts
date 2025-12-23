import { baseApi } from '@services/baseApi';
import type {
  AircraftType,
  Kit,
  KitBox,
  KitItem,
  KitExpendable,
  KitIssuance,
  KitReorderRequest,
  KitAnalytics,
  KitAlertResponse,
  KitActivity,
  KitFormData,
  KitBoxFormData,
  KitItemFormData,
  KitExpendableFormData,
  KitIssuanceFormData,
  KitsQueryParams,
  KitItemsQueryParams,
  KitExpendablesQueryParams,
  KitItemsResponse,
  KitExpendablesResponse,
  KitWizardResponse,
  KitLocationsResponse,
  KitLocationFormData,
  CreateReorderRequest,
  ReorderFilters,
} from '../types';

export const kitsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== Aircraft Types ====================
    getAircraftTypes: builder.query<AircraftType[], { include_inactive?: boolean }>({
      query: (params = {}) => ({
        url: '/api/aircraft-types',
        params: {
          include_inactive: params.include_inactive || false,
        },
      }),
      providesTags: ['Kit'],
    }),

    createAircraftType: builder.mutation<AircraftType, { name: string; description?: string }>({
      query: (body) => ({
        url: '/api/aircraft-types',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Kit'],
    }),

    updateAircraftType: builder.mutation<
      AircraftType,
      { id: number; data: { name?: string; description?: string; is_active?: boolean } }
    >({
      query: ({ id, data }) => ({
        url: `/api/aircraft-types/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Kit'],
    }),

    deactivateAircraftType: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/aircraft-types/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Kit'],
    }),

    // ==================== Kits ====================
    getKits: builder.query<Kit[], KitsQueryParams | void>({
      query: (params) => ({
        url: '/api/kits',
        params: params || {},
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Kit' as const, id })),
              { type: 'Kit', id: 'LIST' },
            ]
          : [{ type: 'Kit', id: 'LIST' }],
    }),

    getKit: builder.query<Kit, number>({
      query: (id) => `/api/kits/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Kit', id }],
    }),

    createKit: builder.mutation<Kit, KitFormData>({
      query: (body) => ({
        url: '/api/kits',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Kit', id: 'LIST' }],
    }),

    updateKit: builder.mutation<Kit, { id: number; data: Partial<KitFormData> }>({
      query: ({ id, data }) => ({
        url: `/api/kits/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Kit', id },
        { type: 'Kit', id: 'LIST' },
      ],
    }),

    deleteKit: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/kits/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Kit', id: 'LIST' }],
    }),

    duplicateKit: builder.mutation<Kit, { id: number; name: string; description?: string }>({
      query: ({ id, ...body }) => ({
        url: `/api/kits/${id}/duplicate`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Kit', id: 'LIST' }],
    }),

    // Kit Wizard
    kitWizard: builder.mutation<KitWizardResponse, { step: number; [key: string]: unknown }>({
      query: (body) => ({
        url: '/api/kits/wizard',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, args) => {
        // Only invalidate if this is step 4 (final creation step)
        if (args.step === 4) {
          return [{ type: 'Kit', id: 'LIST' }];
        }
        return [];
      },
    }),

    // ==================== Kit Boxes ====================
    getKitBoxes: builder.query<KitBox[], number>({
      query: (kitId) => `/api/kits/${kitId}/boxes`,
      providesTags: (_result, _error, kitId) => [{ type: 'Kit', id: kitId }],
    }),

    addKitBox: builder.mutation<KitBox, { kitId: number; data: KitBoxFormData }>({
      query: ({ kitId, data }) => ({
        url: `/api/kits/${kitId}/boxes`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    updateKitBox: builder.mutation<
      KitBox,
      { kitId: number; boxId: number; data: Partial<KitBoxFormData> }
    >({
      query: ({ kitId, boxId, data }) => ({
        url: `/api/kits/${kitId}/boxes/${boxId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    deleteKitBox: builder.mutation<void, { kitId: number; boxId: number }>({
      query: ({ kitId, boxId }) => ({
        url: `/api/kits/${kitId}/boxes/${boxId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    // ==================== Kit Items ====================
    getKitItems: builder.query<KitItemsResponse, { kitId: number; params?: KitItemsQueryParams }>({
      query: ({ kitId, params }) => ({
        url: `/api/kits/${kitId}/items`,
        params: params || {},
      }),
      providesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    getKitItemDetails: builder.query<
      { item: KitItem; history: KitIssuance[]; total_issuances: number },
      { kitId: number; itemId: number }
    >({
      query: ({ kitId, itemId }) => `/api/kits/${kitId}/items/${itemId}/details`,
      providesTags: (_result, _error, { kitId, itemId }) => [
        { type: 'Kit', id: kitId },
        { type: 'Kit', id: `item-${itemId}` },
      ],
    }),

    addKitItem: builder.mutation<KitItem, { kitId: number; data: KitItemFormData }>({
      query: ({ kitId, data }) => ({
        url: `/api/kits/${kitId}/items`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { kitId }) => [
        { type: 'Kit', id: kitId },
        { type: 'Warehouse' },
      ],
    }),

    updateKitItem: builder.mutation<
      KitItem,
      { kitId: number; itemId: number; data: { quantity?: number; location?: string; status?: string } }
    >({
      query: ({ kitId, itemId, data }) => ({
        url: `/api/kits/${kitId}/items/${itemId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    removeKitItem: builder.mutation<void, { kitId: number; itemId: number }>({
      query: ({ kitId, itemId }) => ({
        url: `/api/kits/${kitId}/items/${itemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    // ==================== Kit Expendables ====================
    getKitExpendables: builder.query<
      KitExpendablesResponse,
      { kitId: number; params?: KitExpendablesQueryParams }
    >({
      query: ({ kitId, params }) => ({
        url: `/api/kits/${kitId}/expendables`,
        params: params || {},
      }),
      providesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    addKitExpendable: builder.mutation<KitExpendable, { kitId: number; data: KitExpendableFormData }>({
      query: ({ kitId, data }) => ({
        url: `/api/kits/${kitId}/expendables`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    updateKitExpendable: builder.mutation<
      KitExpendable,
      {
        kitId: number;
        expendableId: number;
        data: { quantity?: number; location?: string; status?: string; minimum_stock_level?: number };
      }
    >({
      query: ({ kitId, expendableId, data }) => ({
        url: `/api/kits/${kitId}/expendables/${expendableId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    removeKitExpendable: builder.mutation<void, { kitId: number; expendableId: number }>({
      query: ({ kitId, expendableId }) => ({
        url: `/api/kits/${kitId}/expendables/${expendableId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    // ==================== Kit Issuance ====================
    issueFromKit: builder.mutation<KitIssuance, { kitId: number; data: KitIssuanceFormData }>({
      query: ({ kitId, data }) => ({
        url: `/api/kits/${kitId}/issue`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    getAllKitIssuances: builder.query<
      KitIssuance[],
      {
        kit_id?: number;
        aircraft_type_id?: number;
        start_date?: string;
        end_date?: string;
      }
    >({
      query: (params) => ({
        url: '/api/kits/issuances',
        params,
      }),
      providesTags: ['Kit'],
    }),

    getKitIssuances: builder.query<
      KitIssuance[],
      { kitId: number; start_date?: string; end_date?: string }
    >({
      query: ({ kitId, ...params }) => ({
        url: `/api/kits/${kitId}/issuances`,
        params,
      }),
      providesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    getKitIssuance: builder.query<KitIssuance, { kitId: number; issuanceId: number }>({
      query: ({ kitId, issuanceId }) => `/api/kits/${kitId}/issuances/${issuanceId}`,
      providesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    // ==================== Analytics & Reports ====================
    getKitAnalytics: builder.query<KitAnalytics, { kitId: number; days?: number }>({
      query: ({ kitId, days }) => ({
        url: `/api/kits/${kitId}/analytics`,
        params: { days: days || 30 },
      }),
      providesTags: (_result, _error, { kitId }) => [{ type: 'Kit', id: kitId }],
    }),

    getKitAlerts: builder.query<KitAlertResponse, number>({
      query: (kitId) => `/api/kits/${kitId}/alerts`,
      providesTags: (_result, _error, kitId) => [{ type: 'Kit', id: kitId }],
    }),

    getRecentKitActivity: builder.query<KitActivity[], { limit?: number }>({
      query: (params) => ({
        url: '/api/kits/recent-activity',
        params: { limit: params.limit || 10 },
      }),
      providesTags: ['Kit'],
    }),

    getInventoryReport: builder.query<
      Array<{
        kit_id: number;
        kit_name: string;
        aircraft_type: string;
        total_items: number;
        low_stock_items: number;
        boxes: number;
      }>,
      { aircraft_type_id?: number; kit_id?: number }
    >({
      query: (params) => ({
        url: '/api/kits/reports/inventory',
        params,
      }),
      providesTags: ['Kit'],
    }),

    getReorderReport: builder.query<
      KitReorderRequest[],
      {
        aircraft_type_id?: number;
        kit_id?: number;
        status?: string;
        start_date?: string;
        end_date?: string;
      }
    >({
      query: (params) => ({
        url: '/api/kits/reorders',
        params,
      }),
      providesTags: ['Kit'],
    }),

    getKitUtilizationAnalytics: builder.query<
      {
        issuancesByKit: Array<{ name: string; value: number }>;
        transfersByType: Array<{ name: string; value: number }>;
        activityOverTime: Array<{ date: string; issuances: number; transfers: number }>;
        summary: {
          totalIssuances: number;
          totalTransfers: number;
          activeKits: number;
          avgUtilization: number;
        };
      },
      { days?: number; aircraft_type_id?: number; kit_id?: number }
    >({
      query: (params) => ({
        url: '/api/kits/analytics/utilization',
        params: { days: params.days || 30, ...params },
      }),
      providesTags: ['Kit'],
    }),

    // ==================== Kit Locations ====================
    getKitLocations: builder.query<
      KitLocationsResponse,
      { aircraft_type_id?: number; status?: string; with_location_only?: boolean } | void
    >({
      query: (params) => ({
        url: '/api/kits/locations',
        params: params || {},
      }),
      providesTags: ['Kit'],
    }),

    updateKitLocation: builder.mutation<
      { message: string; kit: { id: number; location_address: string | null; latitude: number | null; longitude: number | null } },
      { id: number; data: KitLocationFormData }
    >({
      query: ({ id, data }) => ({
        url: `/api/kits/${id}/location`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Kit', id },
        { type: 'Kit', id: 'LIST' },
      ],
    }),

    // ==================== Reorders ====================
    getKitReorders: builder.query<KitReorderRequest[], { kitId: number; params?: ReorderFilters }>({
      query: ({ kitId, params }) => ({
        url: '/api/reorder-requests',
        params: { kit_id: kitId, ...params },
      }),
      providesTags: (result, _error, { kitId }) => [
        { type: 'Kit', id: `reorders-${kitId}` },
        ...(result?.map(({ id }) => ({ type: 'KitReorder' as const, id })) ?? []),
      ],
    }),

    getReorderDetails: builder.query<KitReorderRequest, number>({
      query: (id) => `/api/reorder-requests/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'KitReorder', id }],
    }),

    createReorder: builder.mutation<KitReorderRequest, { kitId: number; data: CreateReorderRequest }>({
      query: ({ kitId, data }) => {
        // Handle multipart/form-data if image exists
        if (data.image) {
          const formData = new FormData();
          formData.append('item_type', data.item_type);
          if (data.item_id) formData.append('item_id', data.item_id.toString());
          formData.append('part_number', data.part_number);
          formData.append('description', data.description);
          formData.append('quantity_requested', data.quantity_requested.toString());
          if (data.priority) formData.append('priority', data.priority);
          if (data.notes) formData.append('notes', data.notes);
          formData.append('image', data.image);

          return {
            url: `/api/kits/${kitId}/reorder`,
            method: 'POST',
            body: formData,
          };
        }

        // JSON request (no image)
        return {
          url: `/api/kits/${kitId}/reorder`,
          method: 'POST',
          body: data,
        };
      },
      invalidatesTags: (_result, _error, { kitId }) => [
        { type: 'Kit', id: `reorders-${kitId}` },
        { type: 'Kit', id: kitId },
      ],
    }),

    approveReorder: builder.mutation<KitReorderRequest, number>({
      query: (id) => ({
        url: `/api/reorder-requests/${id}/approve`,
        method: 'PUT',
      }),
      invalidatesTags: (result, _error, id) => [
        { type: 'KitReorder', id },
        { type: 'Kit', id: result?.kit_id },
        { type: 'Kit', id: `reorders-${result?.kit_id}` },
      ],
    }),

    markReorderOrdered: builder.mutation<KitReorderRequest, number>({
      query: (id) => ({
        url: `/api/reorder-requests/${id}/order`,
        method: 'PUT',
      }),
      invalidatesTags: (result, _error, id) => [
        { type: 'KitReorder', id },
        { type: 'Kit', id: result?.kit_id },
        { type: 'Kit', id: `reorders-${result?.kit_id}` },
      ],
    }),

    fulfillReorder: builder.mutation<KitReorderRequest, { id: number; box_id?: number }>({
      query: ({ id, box_id }) => ({
        url: `/api/reorder-requests/${id}/fulfill`,
        method: 'PUT',
        body: box_id ? { box_id } : {},
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: 'KitReorder', id },
        { type: 'Kit', id: result?.kit_id },
        { type: 'Kit', id: `items-${result?.kit_id}` },
        { type: 'Kit', id: `reorders-${result?.kit_id}` },
      ],
    }),

    cancelReorder: builder.mutation<KitReorderRequest, number>({
      query: (id) => ({
        url: `/api/reorder-requests/${id}/cancel`,
        method: 'PUT',
      }),
      invalidatesTags: (result, _error, id) => [
        { type: 'KitReorder', id },
        { type: 'Kit', id: result?.kit_id },
        { type: 'Kit', id: `reorders-${result?.kit_id}` },
      ],
    }),

    updateReorder: builder.mutation<KitReorderRequest, { id: number; data: Partial<CreateReorderRequest> }>({
      query: ({ id, data }) => ({
        url: `/api/reorder-requests/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: 'KitReorder', id },
        { type: 'Kit', id: result?.kit_id },
        { type: 'Kit', id: `reorders-${result?.kit_id}` },
      ],
    }),
  }),
});

export const {
  // Aircraft Types
  useGetAircraftTypesQuery,
  useCreateAircraftTypeMutation,
  useUpdateAircraftTypeMutation,
  useDeactivateAircraftTypeMutation,

  // Kits
  useGetKitsQuery,
  useGetKitQuery,
  useCreateKitMutation,
  useUpdateKitMutation,
  useDeleteKitMutation,
  useDuplicateKitMutation,
  useKitWizardMutation,

  // Boxes
  useGetKitBoxesQuery,
  useAddKitBoxMutation,
  useUpdateKitBoxMutation,
  useDeleteKitBoxMutation,

  // Items
  useGetKitItemsQuery,
  useGetKitItemDetailsQuery,
  useAddKitItemMutation,
  useUpdateKitItemMutation,
  useRemoveKitItemMutation,

  // Expendables
  useGetKitExpendablesQuery,
  useAddKitExpendableMutation,
  useUpdateKitExpendableMutation,
  useRemoveKitExpendableMutation,

  // Issuance
  useIssueFromKitMutation,
  useGetAllKitIssuancesQuery,
  useGetKitIssuancesQuery,
  useGetKitIssuanceQuery,

  // Analytics & Reports
  useGetKitAnalyticsQuery,
  useGetKitAlertsQuery,
  useGetRecentKitActivityQuery,
  useGetInventoryReportQuery,
  useGetReorderReportQuery,
  useGetKitUtilizationAnalyticsQuery,

  // Locations
  useGetKitLocationsQuery,
  useUpdateKitLocationMutation,

  // Reorders
  useGetKitReordersQuery,
  useGetReorderDetailsQuery,
  useCreateReorderMutation,
  useApproveReorderMutation,
  useMarkReorderOrderedMutation,
  useFulfillReorderMutation,
  useCancelReorderMutation,
  useUpdateReorderMutation,
} = kitsApi;
