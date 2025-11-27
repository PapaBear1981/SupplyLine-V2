import type { User as ProfileUser } from '@features/users/types';

export interface LoginRequest {
  employee_number: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  user: User;
  message?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export type User = ProfileUser;
