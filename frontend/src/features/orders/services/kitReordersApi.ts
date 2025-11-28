import { baseApi } from '@services/baseApi';
import type {
  KitReorderRequest,
  CreateKitReorderRequest,
  UpdateKitReorderRequest,
  KitReordersListParams,
} from '../types';

export const kitReordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ========================================================================
    // Kit Reorder Requests CRUD
    // ========================================================================

    getKitReorders: builder.query<KitReorderRequest[], KitReordersListParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              searchParams.append(key, String(value));
            }
          });
        }
        return `/api/reorder-requests?${searchParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'KitReorder' as const, id })),
              { type: 'KitReorder', id: 'LIST' },
            ]
          : [{ type: 'KitReorder', id: 'LIST' }],
    }),

    getKitReorder: builder.query<KitReorderRequest, number>({
      query: (reorderId) => `/api/reorder-requests/${reorderId}`,
      providesTags: (_result, _error, id) => [{ type: 'KitReorder', id }],
    }),

    createKitReorder: builder.mutation<
      KitReorderRequest,
      { kitId: number; data: CreateKitReorderRequest }
    >({
      query: ({ kitId, data }) => {
        // If image file exists, use FormData
        if (data.image) {
          const formData = new FormData();
          Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              if (key === 'image' && value instanceof File) {
                formData.append(key, value);
              } else {
                formData.append(key, String(value));
              }
            }
          });
          return {
            url: `/api/kits/${kitId}/reorder`,
            method: 'POST',
            body: formData,
          };
        }

        // Otherwise use JSON
        return {
          url: `/api/kits/${kitId}/reorder`,
          method: 'POST',
          body: data,
        };
      },
      invalidatesTags: [{ type: 'KitReorder', id: 'LIST' }, { type: 'Request', id: 'LIST' }],
    }),

    updateKitReorder: builder.mutation<
      KitReorderRequest,
      { reorderId: number; updates: UpdateKitReorderRequest }
    >({
      query: ({ reorderId, updates }) => ({
        url: `/api/reorder-requests/${reorderId}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { reorderId }) => [
        { type: 'KitReorder', id: reorderId },
        { type: 'KitReorder', id: 'LIST' },
      ],
    }),

    approveKitReorder: builder.mutation<KitReorderRequest, number>({
      query: (reorderId) => ({
        url: `/api/reorder-requests/${reorderId}/approve`,
        method: 'PUT',
      }),
      invalidatesTags: (_result, _error, reorderId) => [
        { type: 'KitReorder', id: reorderId },
        { type: 'KitReorder', id: 'LIST' },
      ],
    }),

    markKitReorderAsOrdered: builder.mutation<
      KitReorderRequest,
      { reorderId: number; vendor?: string; trackingNumber?: string }
    >({
      query: ({ reorderId, vendor, trackingNumber }) => ({
        url: `/api/reorder-requests/${reorderId}/order`,
        method: 'PUT',
        body: { vendor, tracking_number: trackingNumber },
      }),
      invalidatesTags: (_result, _error, { reorderId }) => [
        { type: 'KitReorder', id: reorderId },
        { type: 'KitReorder', id: 'LIST' },
      ],
    }),

    fulfillKitReorder: builder.mutation<
      KitReorderRequest,
      { reorderId: number; notes?: string }
    >({
      query: ({ reorderId, notes }) => ({
        url: `/api/reorder-requests/${reorderId}/fulfill`,
        method: 'PUT',
        body: { notes },
      }),
      invalidatesTags: (_result, _error, { reorderId }) => [
        { type: 'KitReorder', id: reorderId },
        { type: 'KitReorder', id: 'LIST' },
      ],
    }),

    cancelKitReorder: builder.mutation<
      KitReorderRequest,
      { reorderId: number; reason?: string }
    >({
      query: ({ reorderId, reason }) => ({
        url: `/api/reorder-requests/${reorderId}/cancel`,
        method: 'PUT',
        body: { reason },
      }),
      invalidatesTags: (_result, _error, { reorderId }) => [
        { type: 'KitReorder', id: reorderId },
        { type: 'KitReorder', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetKitReordersQuery,
  useGetKitReorderQuery,
  useCreateKitReorderMutation,
  useUpdateKitReorderMutation,
  useApproveKitReorderMutation,
  useMarkKitReorderAsOrderedMutation,
  useFulfillKitReorderMutation,
  useCancelKitReorderMutation,
  useLazyGetKitReordersQuery,
} = kitReordersApi;
