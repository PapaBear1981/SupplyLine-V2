import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '@app/store';
import { logout } from '@features/auth/slices/authSlice';

const baseQuery = fetchBaseQuery({
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
});

const baseQueryWithAuth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);

  // If we get a 401 or 403 error, automatically logout the user
  if (result.error && (result.error.status === 401 || result.error.status === 403)) {
    // Dispatch logout action to clear auth state
    api.dispatch(logout());

    // Disconnect WebSocket if connected
    try {
      const { socketService } = await import('@services/socket');
      socketService.disconnect();
    } catch {
      // Socket service might not be available, ignore
    }

    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
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
    'OrderRequestItems',
    'Request',
    'RequestMessage',
    'RequestAnalytics',
    'KitReorder',
    'Permission',
    'SystemSettings',
  ],
  endpoints: () => ({}),
});
