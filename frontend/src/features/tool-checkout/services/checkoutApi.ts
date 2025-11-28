import { baseApi } from '@services/baseApi';
import type {
  CheckinRequest,
  CheckoutListResponse,
  CheckoutQueryParams,
  CheckoutRequest,
  CheckoutStats,
  ExtendCheckoutRequest,
  ReportDamageRequest,
  TimelineQueryParams,
  ToolAvailability,
  ToolCheckout,
  ToolSearchResult,
  ToolTimelineResponse,
} from '../types';

export const checkoutApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ==========================================
    // Tool Availability
    // ==========================================
    checkToolAvailability: builder.query<ToolAvailability, number>({
      query: (toolId) => `/api/tools/${toolId}/availability`,
      providesTags: (_result, _error, toolId) => [{ type: 'Tool', id: toolId }],
    }),

    // ==========================================
    // Checkout Operations
    // ==========================================
    createCheckout: builder.mutation<
      { message: string; checkout: ToolCheckout },
      CheckoutRequest
    >({
      query: (body) => ({
        url: '/api/tool-checkout',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { tool_id }) => [
        { type: 'Tool' as const, id: tool_id },
        { type: 'Tool' as const, id: 'LIST' },
        { type: 'Checkout' as const, id: 'LIST' },
        { type: 'Checkout' as const, id: 'ACTIVE' },
        { type: 'Checkout' as const, id: 'MY' },
        { type: 'Checkout' as const, id: 'STATS' },
      ],
    }),

    checkinTool: builder.mutation<
      { message: string; checkout: ToolCheckout; damage_reported: boolean },
      { checkoutId: number; data: CheckinRequest }
    >({
      query: ({ checkoutId, data }) => ({
        url: `/api/tool-checkout/${checkoutId}/checkin`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, _error, { checkoutId }) => [
        ...(result?.checkout
          ? [{ type: 'Tool' as const, id: result.checkout.tool_id }]
          : []),
        { type: 'Tool' as const, id: 'LIST' },
        { type: 'Checkout' as const, id: checkoutId },
        { type: 'Checkout' as const, id: 'LIST' },
        { type: 'Checkout' as const, id: 'ACTIVE' },
        { type: 'Checkout' as const, id: 'MY' },
        { type: 'Checkout' as const, id: 'OVERDUE' },
        { type: 'Checkout' as const, id: 'STATS' },
      ],
    }),

    // ==========================================
    // Checkout Queries
    // ==========================================
    getActiveCheckouts: builder.query<CheckoutListResponse, CheckoutQueryParams | void>({
      query: (params = {}) => {
        const queryParams = params;
        return {
          url: '/api/tool-checkouts/active',
          params: {
            page: queryParams.page || 1,
            per_page: queryParams.per_page || 50,
            ...(queryParams.q && { q: queryParams.q }),
            ...(queryParams.department && { department: queryParams.department }),
            ...(queryParams.overdue_only && { overdue_only: 'true' }),
          },
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.checkouts.map(({ id }) => ({
                type: 'Checkout' as const,
                id,
              })),
              { type: 'Checkout' as const, id: 'ACTIVE' },
            ]
          : [{ type: 'Checkout' as const, id: 'ACTIVE' }],
    }),

    getMyCheckouts: builder.query<CheckoutListResponse, CheckoutQueryParams | void>({
      query: (params = {}) => {
        const queryParams = params;
        return {
          url: '/api/tool-checkouts/my',
          params: {
            page: queryParams.page || 1,
            per_page: queryParams.per_page || 50,
            ...(queryParams.include_returned && { include_returned: 'true' }),
          },
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.checkouts.map(({ id }) => ({
                type: 'Checkout' as const,
                id,
              })),
              { type: 'Checkout' as const, id: 'MY' },
            ]
          : [{ type: 'Checkout' as const, id: 'MY' }],
    }),

    getOverdueCheckouts: builder.query<CheckoutListResponse, CheckoutQueryParams | void>({
      query: (params = {}) => {
        const queryParams = params;
        return {
          url: '/api/tool-checkouts/overdue',
          params: {
            page: queryParams.page || 1,
            per_page: queryParams.per_page || 50,
          },
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.checkouts.map(({ id }) => ({
                type: 'Checkout' as const,
                id,
              })),
              { type: 'Checkout' as const, id: 'OVERDUE' },
            ]
          : [{ type: 'Checkout' as const, id: 'OVERDUE' }],
    }),

    getCheckoutDetails: builder.query<ToolCheckout & { tool?: Record<string, unknown>; user?: Record<string, unknown> }, number>({
      query: (checkoutId) => `/api/tool-checkouts/${checkoutId}`,
      providesTags: (_result, _error, checkoutId) => [
        { type: 'Checkout' as const, id: checkoutId },
      ],
    }),

    // ==========================================
    // Tool History
    // ==========================================
    getToolCheckoutHistory: builder.query<
      CheckoutListResponse & { tool: Record<string, unknown> },
      { toolId: number; params?: CheckoutQueryParams }
    >({
      query: ({ toolId, params }) => ({
        url: `/api/tools/${toolId}/checkout-history`,
        params: {
          page: params?.page || 1,
          per_page: params?.per_page || 50,
        },
      }),
      providesTags: (_result, _error, { toolId }) => [
        { type: 'Tool', id: toolId },
        { type: 'Checkout' as const, id: 'LIST' },
      ],
    }),

    getToolTimeline: builder.query<
      ToolTimelineResponse,
      { toolId: number; params?: TimelineQueryParams }
    >({
      query: ({ toolId, params }) => ({
        url: `/api/tools/${toolId}/timeline`,
        params: {
          page: params?.page || 1,
          per_page: params?.per_page || 100,
          ...(params?.event_type && { event_type: params.event_type }),
        },
      }),
      providesTags: (_result, _error, { toolId }) => [
        { type: 'Tool', id: toolId },
      ],
    }),

    // ==========================================
    // Statistics
    // ==========================================
    getCheckoutStats: builder.query<CheckoutStats, void>({
      query: () => '/api/tool-checkouts/stats',
      providesTags: [{ type: 'Checkout' as const, id: 'STATS' }],
    }),

    // ==========================================
    // Tool Search for Checkout
    // ==========================================
    searchToolsForCheckout: builder.query<{ tools: ToolSearchResult[] }, string>({
      query: (searchTerm) => ({
        url: '/api/tool-checkout/search',
        params: { q: searchTerm },
      }),
      providesTags: [{ type: 'Tool', id: 'LIST' }],
    }),

    // ==========================================
    // Damage Reporting
    // ==========================================
    reportDamage: builder.mutation<
      { message: string; checkout: ToolCheckout },
      { checkoutId: number; data: ReportDamageRequest }
    >({
      query: ({ checkoutId, data }) => ({
        url: `/api/tool-checkouts/${checkoutId}/report-damage`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, _error, { checkoutId }) => [
        ...(result?.checkout
          ? [{ type: 'Tool' as const, id: result.checkout.tool_id }]
          : []),
        { type: 'Tool' as const, id: 'LIST' },
        { type: 'Checkout' as const, id: checkoutId },
        { type: 'Checkout' as const, id: 'ACTIVE' },
        { type: 'Checkout' as const, id: 'LIST' },
        { type: 'Checkout' as const, id: 'STATS' },
      ],
    }),

    // ==========================================
    // Extend Checkout
    // ==========================================
    extendCheckout: builder.mutation<
      { message: string; checkout: ToolCheckout },
      { checkoutId: number; data: ExtendCheckoutRequest }
    >({
      query: ({ checkoutId, data }) => ({
        url: `/api/tool-checkouts/${checkoutId}/extend`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, _error, { checkoutId }) => [
        ...(result?.checkout
          ? [{ type: 'Tool' as const, id: result.checkout.tool_id }]
          : []),
        { type: 'Checkout' as const, id: checkoutId },
        { type: 'Checkout' as const, id: 'ACTIVE' },
        { type: 'Checkout' as const, id: 'OVERDUE' },
        { type: 'Checkout' as const, id: 'LIST' },
        { type: 'Checkout' as const, id: 'STATS' },
      ],
    }),
  }),
});

export const {
  // Availability
  useCheckToolAvailabilityQuery,
  useLazyCheckToolAvailabilityQuery,

  // Checkout operations
  useCreateCheckoutMutation,
  useCheckinToolMutation,

  // Queries
  useGetActiveCheckoutsQuery,
  useGetMyCheckoutsQuery,
  useGetOverdueCheckoutsQuery,
  useGetCheckoutDetailsQuery,

  // History
  useGetToolCheckoutHistoryQuery,
  useGetToolTimelineQuery,

  // Stats
  useGetCheckoutStatsQuery,

  // Search
  useSearchToolsForCheckoutQuery,
  useLazySearchToolsForCheckoutQuery,

  // Actions
  useReportDamageMutation,
  useExtendCheckoutMutation,
} = checkoutApi;
