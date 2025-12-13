import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '@app/store';
import { logout } from '@features/auth/slices/authSlice';

// Mutex to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

const baseQuery = fetchBaseQuery({
  // Use empty string for production (proxied by nginx) or explicit URL for development
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  credentials: 'include', // Important: Include cookies with requests for HttpOnly token refresh
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

// Refresh token function
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Include HttpOnly cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.debug('Token refreshed successfully');
      return true;
    }

    console.debug('Token refresh failed:', response.status);
    return false;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

const baseQueryWithAuth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  // If we get a 401 error, try to refresh the token
  if (result.error && result.error.status === 401) {
    // Check if this is the refresh endpoint itself to avoid infinite loop
    const url = typeof args === 'string' ? args : args.url;
    if (url === '/api/auth/refresh' || url === '/api/auth/login') {
      // Don't try to refresh for auth endpoints
      return result;
    }

    // Use mutex to prevent multiple simultaneous refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }

    // Wait for the refresh to complete
    const refreshSuccess = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshSuccess) {
      // Retry the original request with the new token
      result = await baseQuery(args, api, extraOptions);
    } else {
      // Refresh failed - logout the user
      api.dispatch(logout());

      // Disconnect WebSocket if connected
      try {
        const { socketService } = await import('@services/socket');
        socketService.disconnect();
      } catch (error) {
        console.debug('Socket disconnect skipped during logout:', error instanceof Error ? error.message : 'service unavailable');
      }

      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  } else if (result.error && result.error.status === 403) {
    // 403 means permission denied, not authentication issue
    // Don't logout for 403 errors - the user is authenticated but not authorized
    console.debug('Permission denied (403) - user lacks required permissions');
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
