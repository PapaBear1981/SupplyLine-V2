import { baseApi } from '@services/baseApi';
import type {
  CancelTransferPayload,
  InitiateTransferPayload,
  ItemLookupParams,
  ItemLookupResult,
  ReceiveTransferPayload,
  Transfer,
  TransfersListResponse,
  TransfersQueryParams,
} from '../types';

// Broad invalidation: clears all Transfer entries so both warehouse-keyed
// and unkeyed inbound/outbound caches are evicted after a write.
const WRITE_INVALIDATIONS = [
  { type: 'Transfer' as const, id: 'LIST' },
  { type: 'Transfer' as const },
  { type: 'Tool' as const, id: 'LIST' },
  { type: 'Chemical' as const, id: 'LIST' },
];

export const transfersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listTransfers: builder.query<TransfersListResponse, TransfersQueryParams | void>({
      query: (params) => {
        const p = params || {};
        return {
          url: '/api/transfers',
          params: {
            page: p.page || 1,
            per_page: p.per_page || 50,
            ...(p.status && p.status !== 'all' && { status: p.status }),
            ...(p.item_type && { item_type: p.item_type }),
          },
        };
      },
      providesTags: [{ type: 'Transfer', id: 'LIST' }],
    }),

    listInboundTransfers: builder.query<TransfersListResponse, TransfersQueryParams | void>({
      query: (params) => {
        const p = params || {};
        return {
          url: '/api/transfers/inbound',
          params: {
            page: p.page || 1,
            per_page: p.per_page || 50,
            ...((!p.status || p.status === 'all') ? { status: 'pending_receipt' } : { status: p.status }),
          },
        };
      },
      // Keyed by warehouse so the cache is invalidated on warehouse switch
      providesTags: (_r, _e, params) => {
        const wh = (params as TransfersQueryParams)?.activeWarehouseId;
        return [{ type: 'Transfer', id: wh ? `INBOUND_${wh}` : 'INBOUND' }];
      },
    }),

    listOutboundTransfers: builder.query<TransfersListResponse, TransfersQueryParams | void>({
      query: (params) => {
        const p = params || {};
        return {
          url: '/api/transfers/outbound',
          params: {
            page: p.page || 1,
            per_page: p.per_page || 50,
            ...(p.status && p.status !== 'all' && { status: p.status }),
          },
        };
      },
      providesTags: (_r, _e, params) => {
        const wh = (params as TransfersQueryParams)?.activeWarehouseId;
        return [{ type: 'Transfer', id: wh ? `OUTBOUND_${wh}` : 'OUTBOUND' }];
      },
    }),

    getTransfer: builder.query<{ transfer: Transfer }, number>({
      query: (id) => ({ url: `/api/transfers/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'Transfer', id }],
    }),

    initiateTransfer: builder.mutation<
      { message: string; transfer: Transfer },
      InitiateTransferPayload
    >({
      query: (body) => ({
        url: '/api/transfers/initiate',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        ...WRITE_INVALIDATIONS,
        { type: 'Transfer', id: 'INBOUND' },
        { type: 'Transfer', id: 'OUTBOUND' },
      ],
    }),

    receiveTransfer: builder.mutation<
      { message: string; transfer: Transfer },
      { id: number; data: ReceiveTransferPayload }
    >({
      query: ({ id, data }) => ({
        url: `/api/transfers/${id}/receive`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        ...WRITE_INVALIDATIONS,
        { type: 'Transfer', id },
        { type: 'Transfer', id: 'INBOUND' },
        { type: 'Transfer', id: 'OUTBOUND' },
      ],
    }),

    cancelTransfer: builder.mutation<
      { message: string; transfer: Transfer },
      { id: number; data: CancelTransferPayload }
    >({
      query: ({ id, data }) => ({
        url: `/api/transfers/${id}/cancel`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        ...WRITE_INVALIDATIONS,
        { type: 'Transfer', id },
        { type: 'Transfer', id: 'INBOUND' },
        { type: 'Transfer', id: 'OUTBOUND' },
      ],
    }),

    lookupTransferItem: builder.query<{ item: ItemLookupResult }, ItemLookupParams>({
      query: (params) => ({
        url: '/api/transfers/lookup-item',
        params,
      }),
    }),
  }),
});

export const {
  useListTransfersQuery,
  useListInboundTransfersQuery,
  useListOutboundTransfersQuery,
  useGetTransferQuery,
  useInitiateTransferMutation,
  useReceiveTransferMutation,
  useCancelTransferMutation,
  useLookupTransferItemQuery,
} = transfersApi;
