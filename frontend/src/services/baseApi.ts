import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '@app/store';
import { logout, setCredentials } from '@features/auth/slices/authSlice';
import type { User } from '@features/auth/types';

// Track token expiration
let tokenExpiresAt: number | null = null;
let isRefreshing = false;

export const setTokenExpiration = (expiresIn: number) => {
  // Set expiration time (current time + expires_in seconds)
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  // Store in localStorage so SessionExpiryWarning can access it
  localStorage.setItem('token_expires_at', tokenExpiresAt.toString());
};

const baseQuery = fetchBaseQuery({
  // Use empty string for production (proxied by nginx) or explicit URL for development
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  credentials: 'include', // Important: Include cookies for refresh token
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
  // Check if token needs refresh (if it expires in less than 2 minutes)
  const shouldRefresh = tokenExpiresAt && (tokenExpiresAt - Date.now() < 2 * 60 * 1000);

  // Refresh token if needed and not already refreshing
  if (shouldRefresh && !isRefreshing) {
    isRefreshing = true;

    try {
      const refreshResult = await baseQuery(
        { url: '/api/auth/refresh', method: 'POST' },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        const data = refreshResult.data as { access_token?: string; user: User; expires_in?: number };

        // Update credentials in Redux store
        api.dispatch(setCredentials({
          user: data.user,
          token: data.access_token ?? null
        }));

        // Update token expiration
        if (data.expires_in) {
          setTokenExpiration(data.expires_in);
        }

        console.debug('Token refreshed successfully');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    } finally {
      isRefreshing = false;
    }
  }

  const result = await baseQuery(args, api, extraOptions);

  // Only logout on 401 (unauthenticated). 403 means the user IS
  // authenticated but lacks permission for that specific endpoint —
  // the UI should show a permission error, not kick the user out.
  if (result.error && result.error.status === 401) {
    // Dispatch logout action to clear auth state
    api.dispatch(logout());

    // Disconnect WebSocket if connected
    try {
      const { socketService } = await import('@services/socket');
      socketService.disconnect();
    } catch (error) {
      // Socket service might not be available
      console.debug('Socket disconnect skipped during logout:', error instanceof Error ? error.message : 'service unavailable');
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
    'AISettings',
    'BugReport',
    'OnCall',
  ],
  endpoints: () => ({}),
});
