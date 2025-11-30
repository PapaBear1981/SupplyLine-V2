import type { User as ProfileUser } from '@features/users/types';

export interface LoginRequest {
  employee_number: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  user: User;
  message?: string;
  code?: string;
  requires_totp?: boolean;
  employee_number?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export type User = ProfileUser;

// TOTP Two-Factor Authentication Types
export interface TotpStatusResponse {
  is_totp_enabled: boolean;
}

export interface TotpSetupResponse {
  message: string;
  qr_code: string;
}

export interface TotpVerifySetupRequest {
  code: string;
}

export interface TotpVerifySetupResponse {
  message: string;
  is_totp_enabled: boolean;
}

export interface TotpVerifyRequest {
  employee_number: string;
  code: string;
}

export interface TotpVerifyResponse {
  message: string;
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface TotpDisableRequest {
  password: string;
}

export interface TotpDisableResponse {
  message: string;
  is_totp_enabled: boolean;
}
