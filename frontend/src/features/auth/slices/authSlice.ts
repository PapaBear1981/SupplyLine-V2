import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, User } from '../types';
import { setTokenExpiration } from '@services/baseApi';

// SECURITY: access_token is no longer persisted to localStorage. The token
// lives only in the HttpOnly `access_token` cookie (set by the backend) and
// in this Redux slice while the tab is open. Removing localStorage storage
// closes the most common XSS-token-exfiltration path. On page reload, the
// app boots unauthenticated in Redux but still has the cookie; the first
// authenticated API call round-trips the cookie and backfills user state.
//
// One-time migration: clear any leftover tokens from prior versions so
// browsers that still have them stop leaking them into Authorization headers.
try {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
} catch {
  // Storage may be unavailable (private mode); ignore.
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token?: string | null; expiresIn?: number }>
    ) => {
      const token = action.payload.token ?? null;
      state.user = action.payload.user;
      state.token = token;
      state.isAuthenticated = true;

      // Initialize the inactivity clock so the session timer starts from now,
      // not from a stale or zero value left over from a previous session.
      localStorage.setItem('last_user_activity', Date.now().toString());

      // Set token expiration for automatic refresh.
      if (action.payload.expiresIn) {
        setTokenExpiration(action.payload.expiresIn);
      }
    },
    setSetupToken: (
      state,
      action: PayloadAction<{ user: User; token: string; expiresIn?: number }>
    ) => {
      // Store setup token for TOTP API calls, but DON'T set isAuthenticated
      // This prevents refresh bypass during 2FA setup
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = false; // CRITICAL: Not authenticated until 2FA complete

      // Store in sessionStorage (NOT localStorage) so it clears on browser close
      sessionStorage.setItem('setup_token', action.payload.token);

      if (action.payload.expiresIn) {
        setTokenExpiration(action.payload.expiresIn);
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('last_user_activity');
      sessionStorage.removeItem('setup_token');
    },
  },
});

export const { setCredentials, setSetupToken, logout } = authSlice.actions;
export default authSlice.reducer;
