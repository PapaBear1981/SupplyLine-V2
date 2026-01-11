export type ChemicalStatus =
  | 'available'
  | 'low_stock'
  | 'out_of_stock'
  | 'expired';

export interface MasterChemical {
  id: number;
  part_number: string;
  description: string;
  manufacturer?: string | null;
  category: string;
  unit: string;
  shelf_life_days?: number | null;
  alternative_part_numbers: string[];
  hazard_class?: string | null;
  storage_requirements?: string | null;
  sds_link?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  active_lots_count?: number;
  warehouse_settings?: ChemicalWarehouseSetting[];
}

export interface MasterChemicalFormData {
  part_number: string;
  description: string;
  manufacturer?: string;
  category?: string;
  unit: string;
  shelf_life_days?: number;
  alternative_part_numbers?: string[];
  hazard_class?: string;
  storage_requirements?: string;
  sds_link?: string;
}

export interface ChemicalWarehouseSetting {
  id: number;
  master_chemical_id: number;
  warehouse_id: number;
  warehouse_name?: string | null;
  minimum_stock_level?: number | null;
  maximum_stock_level?: number | null;
  preferred_location?: string | null;
  notes?: string | null;
}

export interface ChemicalWarehouseSettingFormData {
  warehouse_id: number;
  minimum_stock_level?: number;
  maximum_stock_level?: number;
  preferred_location?: string;
  notes?: string;
}

export interface Chemical {
  id: number;
  part_number: string;
  lot_number: string;
  description?: string | null;
  manufacturer?: string | null;
  quantity: number;
  unit: string;
  location?: string | null;
  category?: string | null;
  status: ChemicalStatus;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  date_added: string;
  expiration_date?: string | null;
  minimum_stock_level?: number | null;
  notes?: string | null;
  parent_lot_number?: string | null;
  lot_sequence?: number;
  is_archived?: boolean;
  archived_reason?: string | null;
  archived_date?: string | null;
  needs_reorder?: boolean;
  reorder_status?: string | null;
  reorder_date?: string | null;
  requested_quantity?: number | null;
  expected_delivery_date?: string | null;
  kit_id?: number | null;
  kit_name?: string | null;
  box_id?: number | null;
  box_number?: string | null;
  expiring_soon?: boolean;
  issued_quantity?: number;
  master_chemical_id?: number | null;
  expiration_date_override?: boolean;
  received_date?: string | null;
  master_chemical?: {
    part_number: string;
    description: string;
    manufacturer?: string | null;
    category: string;
    shelf_life_days?: number | null;
  };
}

export interface ChemicalFormData {
  master_chemical_id: number;
  lot_number: string;
  quantity: number;
  warehouse_id: number;
  location?: string;
  received_date?: string;
  expiration_date?: string;
  notes?: string;
}

export interface ChemicalsListResponse {
  chemicals: Chemical[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface ChemicalsQueryParams {
  page?: number;
  per_page?: number;
  q?: string;
  status?: ChemicalStatus;
  category?: string;
  archived?: boolean;
}

export interface ChemicalIssuanceFormData {
  quantity: number;
  hangar: string;
  user_id: number;
  purpose?: string;
  work_order?: string;
  notes?: string;
}

export interface ChemicalIssuance {
  id: number;
  chemical_id: number;
  user_id: number;
  quantity: number;
  hangar: string;
  purpose?: string;
  issue_date: string;
}

export interface ChemicalIssuanceResponse {
  chemical: Chemical;
  issuance: ChemicalIssuance;
  child_chemical?: Chemical;
  auto_reorder_request?: {
    id: number;
    request_number: string;
  };
  message?: string;
}
