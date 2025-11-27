export type WarehouseType = 'main' | 'satellite';

export interface Warehouse {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
  warehouse_type: WarehouseType;
  is_active: boolean;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  tools_count?: number;
  chemicals_count?: number;
  expendables_count?: number;
}

export interface WarehouseFormData {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  warehouse_type: WarehouseType;
  is_active?: boolean;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface WarehousesListResponse {
  warehouses: Warehouse[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface WarehousesQueryParams {
  page?: number;
  per_page?: number;
  include_inactive?: boolean;
  warehouse_type?: WarehouseType;
}
