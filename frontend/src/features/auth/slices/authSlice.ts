import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, User } from '../types';
import { setTokenExpiration } from '@services/baseApi';

const storedToken = localStorage.getItem('access_token');
const initialToken = storedToken && storedToken !== 'undefined' ? storedToken : null;

const initialState: AuthState = {
  user: null,
  token: initialToken,
  isAuthenticated: !!initialToken,
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

      if (token) {
        localStorage.setItem('access_token', token);

        // Set token expiration for automatic refresh
        if (action.payload.expiresIn) {
          setTokenExpiration(action.payload.expiresIn);
        }
      } else {
        localStorage.removeItem('access_token');
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
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('last_user_activity');
      sessionStorage.removeItem('setup_token');
    },
  },
});

export const { setCredentials, setSetupToken, logout } = authSlice.actions;
export default authSlice.reducer;
