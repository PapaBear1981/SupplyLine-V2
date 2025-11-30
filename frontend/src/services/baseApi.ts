import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@app/store';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    // Use empty string for production (proxied by nginx) or explicit URL for development
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
    prepareHeaders: (headers, { getState }) => {
      // Get token from Redux state or localStorage
      const state = getState() as RootState;
      const token = state.auth.token || localStorage.getItem('access_token');

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return headers;
    },
  }),
  tagTypes: [
    'Tool',
    'Chemical',
    'Kit',
    'Warehouse',
    'User',
    'Department',
    'Announcement',
    'Role',
    'Checkout',
    'Order',
    'OrderMessage',
    'OrderAnalytics',
    'Request',
    'RequestMessage',
    'RequestAnalytics',
    'KitReorder',
    'Permission',
  ],
  endpoints: () => ({}),
});
