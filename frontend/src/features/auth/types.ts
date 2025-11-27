export interface User {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  department_id: number | null;
  is_active: boolean;
  avatar?: string;
}

export interface LoginRequest {
  employee_number: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
