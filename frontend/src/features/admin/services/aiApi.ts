import { baseApi } from '@services/baseApi';

export interface AISettings {
  enabled: boolean;
  provider: 'claude' | 'openai' | 'openrouter' | 'ollama';
  model: string;
  base_url: string;
  api_key_configured: boolean;
}

export interface UpdateAISettingsRequest {
  enabled?: boolean;
  provider?: string;
  api_key?: string;
  model?: string;
  base_url?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  provider: string;
  model: string;
}

export const aiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAISettings: builder.query<AISettings, void>({
      query: () => '/api/ai/settings',
      providesTags: ['AISettings'],
    }),

    updateAISettings: builder.mutation<AISettings, UpdateAISettingsRequest>({
      query: (body) => ({
        url: '/api/ai/settings',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['AISettings'],
    }),

    sendChatMessage: builder.mutation<ChatResponse, ChatRequest>({
      query: (body) => ({
        url: '/api/ai/chat',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useGetAISettingsQuery,
  useUpdateAISettingsMutation,
  useSendChatMessageMutation,
} = aiApi;
