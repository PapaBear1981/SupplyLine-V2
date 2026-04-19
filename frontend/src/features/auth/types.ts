import type { User as ProfileUser } from '@features/users/types';

export interface LoginRequest {
  employee_number: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  user: User;
  message?: string;
  expires_in?: number;
  code?: string;
  requires_totp?: boolean;
  requires_totp_setup?: boolean;
  setup_token?: string;
  employee_number?: string;
  used_trusted_device?: boolean;
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
  access_token?: string;
  refresh_token?: string;
  user?: User;
  expires_in?: number;
}

export interface TotpVerifyRequest {
  employee_number: string;
  code: string;
  trust_device?: boolean;
}

export interface TotpVerifyResponse {
  message: string;
  user: User;
  access_token: string;
  refresh_token: string;
  trusted_device_issued?: boolean;
}

export interface TotpDisableRequest {
  password: string;
}

export interface TotpDisableResponse {
  message: string;
  is_totp_enabled: boolean;
}

// Backup Codes Types
export interface BackupCodesResponse {
  message: string;
  backup_codes: string[];
  generated_at: string;
}

export interface BackupCodeVerifyRequest {
  employee_number: string;
  code: string;
  trust_device?: boolean;
}

export interface BackupCodeVerifyResponse {
  message: string;
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  codes_remaining: number;
  trusted_device_issued?: boolean;
}

// Trusted Devices
export interface TrustedDevice {
  id: number;
  device_label: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  is_current: boolean;
}

export interface TrustedDeviceListResponse {
  devices: TrustedDevice[];
}

export interface RevokeAllTrustedDevicesResponse {
  message: string;
  count: number;
}
