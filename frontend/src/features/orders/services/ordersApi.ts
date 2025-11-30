import { baseApi } from '@services/baseApi';
import type {
  ProcurementOrder,
  ProcurementOrderMessage,
  CreateOrderRequest,
  UpdateOrderRequest,
  MarkOrderedRequest,
  MarkDeliveredRequest,
  OrdersListParams,
  OrderAnalytics,
  CreateOrderMessageRequest,
  RequestItem,
  UpdateRequestItemRequest,
} from '../types';

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ========================================================================
    // Orders CRUD
    // ========================================================================

    getOrders: builder.query<ProcurementOrder[], OrdersListParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              searchParams.append(key, String(value));
            }
          });
        }
        return `/api/orders?${searchParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Order' as const, id })),
              { type: 'Order', id: 'LIST' },
            ]
          : [{ type: 'Order', id: 'LIST' }],
    }),

    getOrder: builder.query<ProcurementOrder, number>({
      query: (orderId) => `/api/orders/${orderId}`,
      providesTags: (_result, _error, id) => [{ type: 'Order', id }],
    }),

    createOrder: builder.mutation<ProcurementOrder, CreateOrderRequest>({
      query: (orderData) => {
        // If documentation file exists, use FormData
        if (orderData.documentation) {
          const formData = new FormData();
          Object.entries(orderData).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              if (key === 'documentation' && value instanceof File) {
                formData.append(key, value);
              } else {
                formData.append(key, String(value));
              }
            }
          });
          return {
            url: '/api/orders',
            method: 'POST',
            body: formData,
          };
        }

        // Otherwise use JSON
        return {
          url: '/api/orders',
          method: 'POST',
          body: orderData,
        };
      },
      invalidatesTags: [{ type: 'Order', id: 'LIST' }, 'OrderAnalytics'],
    }),

    updateOrder: builder.mutation<
      ProcurementOrder,
      { orderId: number; updates: UpdateOrderRequest }
    >({
      query: ({ orderId, updates }) => ({
        url: `/api/orders/${orderId}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'Order', id: orderId },
        { type: 'Order', id: 'LIST' },
        'OrderAnalytics',
      ],
    }),

    markOrderAsOrdered: builder.mutation<
      ProcurementOrder,
      { orderId: number; data: MarkOrderedRequest }
    >({
      query: ({ orderId, data }) => ({
        url: `/api/orders/${orderId}/mark-ordered`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'Order', id: orderId },
        { type: 'Order', id: 'LIST' },
        'OrderAnalytics',
      ],
    }),

    markOrderAsDelivered: builder.mutation<
      ProcurementOrder,
      { orderId: number; data?: MarkDeliveredRequest }
    >({
      query: ({ orderId, data }) => ({
        url: `/api/orders/${orderId}/mark-delivered`,
        method: 'POST',
        body: data || {},
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'Order', id: orderId },
        { type: 'Order', id: 'LIST' },
        'OrderAnalytics',
      ],
    }),

    // ========================================================================
    // Order Messages
    // ========================================================================

    getOrderMessages: builder.query<ProcurementOrderMessage[], number>({
      query: (orderId) => `/api/orders/${orderId}/messages`,
      providesTags: (_result, _error, orderId) => [
        { type: 'OrderMessage', id: orderId },
      ],
    }),

    createOrderMessage: builder.mutation<
      ProcurementOrderMessage,
      { orderId: number; message: CreateOrderMessageRequest }
    >({
      query: ({ orderId, message }) => ({
        url: `/api/orders/${orderId}/messages`,
        method: 'POST',
        body: message,
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'OrderMessage', id: orderId },
      ],
    }),

    replyToOrderMessage: builder.mutation<
      ProcurementOrderMessage,
      { messageId: number; reply: { message: string } }
    >({
      query: ({ messageId, reply }) => ({
        url: `/api/orders/messages/${messageId}/reply`,
        method: 'POST',
        body: reply,
      }),
      invalidatesTags: () => [
        { type: 'OrderMessage' },
      ],
    }),

    markOrderMessageAsRead: builder.mutation<void, number>({
      query: (messageId) => ({
        url: `/api/orders/messages/${messageId}/read`,
        method: 'PUT',
      }),
      invalidatesTags: [{ type: 'OrderMessage' }],
    }),

    // ========================================================================
    // Request Items linked to Orders
    // ========================================================================

    getOrderRequestItems: builder.query<RequestItem[], number>({
      query: (orderId) => `/api/orders/${orderId}/request-items`,
      providesTags: (_result, _error, orderId) => [
        { type: 'OrderRequestItems', id: orderId },
      ],
    }),

    markOrderRequestItemsReceived: builder.mutation<
      { message: string; items: RequestItem[] },
      { orderId: number; itemIds: number[] }
    >({
      query: ({ orderId, itemIds }) => ({
        url: `/api/orders/${orderId}/request-items/mark-received`,
        method: 'POST',
        body: { item_ids: itemIds },
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'OrderRequestItems', id: orderId },
        { type: 'Order', id: orderId },
        { type: 'Request', id: 'LIST' },
      ],
    }),

    updateOrderRequestItem: builder.mutation<
      RequestItem,
      { orderId: number; itemId: number; updates: UpdateRequestItemRequest }
    >({
      query: ({ orderId, itemId, updates }) => ({
        url: `/api/orders/${orderId}/request-items/${itemId}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'OrderRequestItems', id: orderId },
        { type: 'Order', id: orderId },
        { type: 'Request', id: 'LIST' },
      ],
    }),

    // ========================================================================
    // Analytics
    // ========================================================================

    getOrderAnalytics: builder.query<OrderAnalytics, void>({
      query: () => '/api/orders/analytics',
      providesTags: ['OrderAnalytics'],
    }),

    getLateOrders: builder.query<ProcurementOrder[], void>({
      query: () => '/api/orders/late-alerts',
      providesTags: [{ type: 'Order', id: 'LATE' }],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useMarkOrderAsOrderedMutation,
  useMarkOrderAsDeliveredMutation,
  useGetOrderMessagesQuery,
  useCreateOrderMessageMutation,
  useReplyToOrderMessageMutation,
  useMarkOrderMessageAsReadMutation,
  useGetOrderRequestItemsQuery,
  useMarkOrderRequestItemsReceivedMutation,
  useUpdateOrderRequestItemMutation,
  useGetOrderAnalyticsQuery,
  useLazyGetOrdersQuery,
  useGetLateOrdersQuery,
} = ordersApi;
