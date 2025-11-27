import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@app/store';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
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
  tagTypes: ['Tool', 'Chemical', 'Kit', 'Warehouse', 'User', 'Department'],
  endpoints: () => ({}),
});
