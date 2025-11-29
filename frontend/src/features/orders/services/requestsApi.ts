import { baseApi } from '@services/baseApi';
import type {
  UserRequest,
  UserRequestMessage,
  RequestItem,
  CreateRequestRequest,
  CreateRequestItemRequest,
  UpdateRequestRequest,
  UpdateRequestItemRequest,
  MarkItemsOrderedRequest,
  MarkItemsReceivedRequest,
  CancelItemsRequest,
  RequestsListParams,
  RequestAnalytics,
  CreateRequestMessageRequest,
} from '../types';

export const requestsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ========================================================================
    // Requests CRUD
    // ========================================================================

    getRequests: builder.query<UserRequest[], RequestsListParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              searchParams.append(key, String(value));
            }
          });
        }
        return `/api/user-requests?${searchParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Request' as const, id })),
              { type: 'Request', id: 'LIST' },
            ]
          : [{ type: 'Request', id: 'LIST' }],
    }),

    getRequest: builder.query<UserRequest, number>({
      query: (requestId) => `/api/user-requests/${requestId}`,
      providesTags: (_result, _error, id) => [{ type: 'Request', id }],
    }),

    createRequest: builder.mutation<UserRequest, CreateRequestRequest>({
      query: (requestData) => ({
        url: '/api/user-requests',
        method: 'POST',
        body: requestData,
      }),
      invalidatesTags: [{ type: 'Request', id: 'LIST' }, 'RequestAnalytics'],
    }),

    updateRequest: builder.mutation<
      UserRequest,
      { requestId: number; updates: UpdateRequestRequest }
    >({
      query: ({ requestId, updates }) => ({
        url: `/api/user-requests/${requestId}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { requestId }) => [
        { type: 'Request', id: requestId },
        { type: 'Request', id: 'LIST' },
        'RequestAnalytics',
      ],
    }),

    cancelRequest: builder.mutation<void, number>({
      query: (requestId) => ({
        url: `/api/user-requests/${requestId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, requestId) => [
        { type: 'Request', id: requestId },
        { type: 'Request', id: 'LIST' },
        'RequestAnalytics',
      ],
    }),

    // ========================================================================
    // Request Items Management
    // ========================================================================

    addItemToRequest: builder.mutation<
      RequestItem,
      { requestId: number; item: CreateRequestItemRequest }
    >({
      query: ({ requestId, item }) => ({
        url: `/api/user-requests/${requestId}/items`,
        method: 'POST',
        body: item,
      }),
      invalidatesTags: (_result, _error, { requestId }) => [
        { type: 'Request', id: requestId },
        { type: 'Request', id: 'LIST' },
        'RequestAnalytics',
      ],
    }),

    updateRequestItem: builder.mutation<
      RequestItem,
      { requestId: number; itemId: number; updates: UpdateRequestItemRequest }
    >({
      query: ({ requestId, itemId, updates }) => ({
        url: `/api/user-requests/${requestId}/items/${itemId}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { requestId }) => [
        { type: 'Request', id: requestId },
        { type: 'Request', id: 'LIST' },
        'RequestAnalytics',
      ],
    }),

    removeItemFromRequest: builder.mutation<
      void,
      { requestId: number; itemId: number }
    >({
      query: ({ requestId, itemId }) => ({
        url: `/api/user-requests/${requestId}/items/${itemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { requestId }) => [
        { type: 'Request', id: requestId },
        { type: 'Request', id: 'LIST' },
        'RequestAnalytics',
      ],
    }),

    markItemsAsOrdered: builder.mutation<
      UserRequest,
      { requestId: number; data: MarkItemsOrderedRequest }
    >({
      query: ({ requestId, data }) => ({
        url: `/api/user-requests/${requestId}/items/mark-ordered`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { requestId }) => [
        { type: 'Request', id: requestId },
        { type: 'Request', id: 'LIST' },
        'RequestAnalytics',
      ],
    }),

    markItemsAsReceived: builder.mutation<
      UserRequest,
      { requestId: number; data: MarkItemsReceivedRequest }
    >({
      query: ({ requestId, data }) => ({
        url: `/api/user-requests/${requestId}/items/mark-received`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { requestId }) => [
        { type: 'Request', id: requestId },
        { type: 'Request', id: 'LIST' },
        'RequestAnalytics',
      ],
    }),

    cancelRequestItems: builder.mutation<
      UserRequest,
      { requestId: number; data: CancelItemsRequest }
    >({
      query: ({ requestId, data }) => ({
        url: `/api/user-requests/${requestId}/items/cancel`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { requestId }) => [
        { type: 'Request', id: requestId },
        { type: 'Request', id: 'LIST' },
        'RequestAnalytics',
      ],
    }),

    // ========================================================================
    // Request Messages
    // ========================================================================

    getRequestMessages: builder.query<UserRequestMessage[], number>({
      query: (requestId) => `/api/user-requests/${requestId}/messages`,
      providesTags: (_result, _error, requestId) => [
        { type: 'RequestMessage', id: requestId },
      ],
    }),

    createRequestMessage: builder.mutation<
      UserRequestMessage,
      { requestId: number; message: CreateRequestMessageRequest }
    >({
      query: ({ requestId, message }) => ({
        url: `/api/user-requests/${requestId}/messages`,
        method: 'POST',
        body: message,
      }),
      invalidatesTags: (_result, _error, { requestId }) => [
        { type: 'RequestMessage', id: requestId },
      ],
    }),

    markRequestMessageAsRead: builder.mutation<void, number>({
      query: (messageId) => ({
        url: `/api/user-requests/messages/${messageId}/read`,
        method: 'PUT',
      }),
      invalidatesTags: [{ type: 'RequestMessage' }],
    }),

    // ========================================================================
    // Analytics
    // ========================================================================

    getRequestAnalytics: builder.query<RequestAnalytics, void>({
      query: () => '/api/user-requests/analytics',
      providesTags: ['RequestAnalytics'],
    }),
  }),
});

export const {
  useGetRequestsQuery,
  useGetRequestQuery,
  useCreateRequestMutation,
  useUpdateRequestMutation,
  useCancelRequestMutation,
  useAddItemToRequestMutation,
  useUpdateRequestItemMutation,
  useRemoveItemFromRequestMutation,
  useMarkItemsAsOrderedMutation,
  useMarkItemsAsReceivedMutation,
  useCancelRequestItemsMutation,
  useGetRequestMessagesQuery,
  useCreateRequestMessageMutation,
  useMarkRequestMessageAsReadMutation,
  useGetRequestAnalyticsQuery,
  useLazyGetRequestsQuery,
} = requestsApi;
