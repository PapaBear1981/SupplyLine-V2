/**
 * RTK Query API slice for AI Agent features.
 */
import { baseApi } from '@services/baseApi';
import type {
  AIAgentsResponse,
  AIChatRequest,
  AIChatResponse,
  AIAlertsResponse,
  AIConversation,
  AIMessage,
  AIMetric,
  AIActionLog,
  AIDashboardData,
} from '../types';

export const aiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Agents ──────────────────────────────────────────────
    getAIAgents: builder.query<AIAgentsResponse, void>({
      query: () => '/api/ai/agents',
      providesTags: ['AIAgent'],
    }),

    toggleAIAgent: builder.mutation<
      { message: string; status: string },
      { agentName: string; action: 'start' | 'stop' | 'toggle' }
    >({
      query: ({ agentName, action }) => ({
        url: `/api/ai/agents/${agentName}/toggle`,
        method: 'POST',
        body: { action },
      }),
      invalidatesTags: ['AIAgent'],
    }),

    // ─── Chat ────────────────────────────────────────────────
    sendAIChatMessage: builder.mutation<AIChatResponse, AIChatRequest>({
      query: (body) => ({
        url: '/api/ai/chat',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AIConversation'],
    }),

    getAIConversations: builder.query<{ conversations: AIConversation[] }, void>({
      query: () => '/api/ai/conversations',
      providesTags: ['AIConversation'],
    }),

    getConversationMessages: builder.query<
      { conversation: AIConversation; messages: AIMessage[] },
      number
    >({
      query: (conversationId) => `/api/ai/conversations/${conversationId}/messages`,
    }),

    // ─── Alerts ──────────────────────────────────────────────
    getAIAlerts: builder.query<
      AIAlertsResponse,
      { status?: string; severity?: string; category?: string; limit?: number } | void
    >({
      query: (params) => ({
        url: '/api/ai/alerts',
        params: params || {},
      }),
      providesTags: ['AIAlert'],
    }),

    acknowledgeAlert: builder.mutation<{ message: string; alert: unknown }, number>({
      query: (alertId) => ({
        url: `/api/ai/alerts/${alertId}/acknowledge`,
        method: 'POST',
      }),
      invalidatesTags: ['AIAlert'],
    }),

    resolveAlert: builder.mutation<{ message: string; alert: unknown }, number>({
      query: (alertId) => ({
        url: `/api/ai/alerts/${alertId}/resolve`,
        method: 'POST',
      }),
      invalidatesTags: ['AIAlert'],
    }),

    dismissAlert: builder.mutation<{ message: string }, number>({
      query: (alertId) => ({
        url: `/api/ai/alerts/${alertId}/dismiss`,
        method: 'POST',
      }),
      invalidatesTags: ['AIAlert'],
    }),

    // ─── Metrics ─────────────────────────────────────────────
    getAIMetrics: builder.query<
      { metrics: AIMetric[]; total: number; period_hours: number },
      { category?: string; metric_name?: string; hours?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/api/ai/metrics',
        params: params || {},
      }),
    }),

    getAIMetricsSummary: builder.query<{ summary: Record<string, { value: number; unit: string | null; category: string; recorded_at: string | null }> }, void>({
      query: () => '/api/ai/metrics/summary',
    }),

    // ─── Action Logs ─────────────────────────────────────────
    getAIActions: builder.query<
      { actions: AIActionLog[]; total: number },
      { action_type?: string; limit?: number } | void
    >({
      query: (params) => ({
        url: '/api/ai/actions',
        params: params || {},
      }),
    }),

    // ─── Dashboard ───────────────────────────────────────────
    getAIDashboard: builder.query<AIDashboardData, void>({
      query: () => '/api/ai/dashboard',
      providesTags: ['AIAgent', 'AIAlert'],
    }),
  }),
});

export const {
  useGetAIAgentsQuery,
  useToggleAIAgentMutation,
  useSendAIChatMessageMutation,
  useGetAIConversationsQuery,
  useGetConversationMessagesQuery,
  useGetAIAlertsQuery,
  useAcknowledgeAlertMutation,
  useResolveAlertMutation,
  useDismissAlertMutation,
  useGetAIMetricsQuery,
  useGetAIMetricsSummaryQuery,
  useGetAIActionsQuery,
  useGetAIDashboardQuery,
} = aiApi;
