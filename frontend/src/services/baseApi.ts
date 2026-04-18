import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '@app/store';
import { logout, setCredentials } from '@features/auth/slices/authSlice';
import type { User } from '@features/auth/types';

// Track token expiration
let tokenExpiresAt: number | null = null;
let isRefreshing = false;

const FALLBACK_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Returns the admin-configured inactivity timeout in ms, falling back to 30 min. */
function getSessionTimeoutMs(): number {
  const cached = localStorage.getItem('session_timeout_ms');
  return cached ? parseInt(cached, 10) : FALLBACK_SESSION_TIMEOUT_MS;
}

/** Returns true only if the user has interacted within the inactivity window. */
function userIsActive(): boolean {
  const lastActivity = parseInt(localStorage.getItem('last_user_activity') || '0', 10);
  if (!lastActivity) return false;
  return Date.now() - lastActivity < getSessionTimeoutMs();
}

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
  // Only refresh if the token is nearly expired AND the user has been recently active.
  // Without the activity gate, background polls and WebSocket pings would refresh the
  // token indefinitely, keeping idle sessions alive forever.
  const tokenNearExpiry = tokenExpiresAt && (tokenExpiresAt - Date.now() < 2 * 60 * 1000);
  const shouldRefresh = tokenNearExpiry && userIsActive();

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
