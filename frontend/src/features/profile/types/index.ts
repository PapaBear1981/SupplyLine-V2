export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ProfileStats {
  tools_checked_out: number;
  chemicals_used: number;
  kits_assembled: number;
  last_activity: string;
}
