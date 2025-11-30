export interface UserRole {
  id: number;
  name: string;
  description?: string;
  is_system_role?: boolean;
  created_at?: string | null;
}

export interface User {
  id: number;
  name: string;
  employee_number: string;
  department: string | null;
  email: string | null;
  is_admin: boolean;
  is_active: boolean;
  avatar?: string | null;
  created_at?: string | null;
  force_password_change?: boolean;
  password_changed_at?: string | null;
  failed_login_attempts?: number;
  account_locked?: boolean;
  account_locked_until?: string | null;
  last_failed_login?: string | null;
  roles?: UserRole[];
  is_totp_enabled?: boolean;
}

export interface Department {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string | null;
}

export interface UsersQueryParams {
  q?: string;
}

export type UserListResponse = User[];

export interface UserFormValues {
  name: string;
  employee_number: string;
  department: string;
  email?: string | null;
  is_admin?: boolean;
  is_active?: boolean;
  password?: string;
}

export interface CreateUserRequest extends UserFormValues {
  password: string;
}
