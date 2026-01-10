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
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('last_user_activity');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
