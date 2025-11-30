import type { User, Department, UserRole } from '@features/users/types';

export interface Announcement {
  id: number;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at?: string;
  expires_at?: string | null;
  target_departments?: string[] | null;
  created_by_user?: User;
}

export interface CreateAnnouncementRequest {
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_active?: boolean;
  expires_at?: string | null;
  target_departments?: string[] | null;
}

export interface UpdateAnnouncementRequest extends Partial<CreateAnnouncementRequest> {
  id: number;
}

export interface ResetPasswordRequest {
  user_id: number;
  new_password: string;
  force_change?: boolean;
}

export interface UpdateUserPermissionsRequest {
  user_id: number;
  role_ids: number[];
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface UpdateDepartmentRequest extends Partial<CreateDepartmentRequest> {
  id: number;
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
}

export interface UpdateRoleRequest extends Partial<CreateRoleRequest> {
  id: number;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  locked_users: number;
  total_departments: number;
  active_announcements: number;
  total_roles: number;
  online_users: number;
}

export interface OnlineUsersResponse {
  online_count: number;
  online_users: {
    user_id: number;
    last_activity: string | null;
  }[];
}

export type { User, Department, UserRole };
