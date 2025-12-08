export type ChemicalStatus =
  | 'available'
  | 'low_stock'
  | 'out_of_stock'
  | 'expired';

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
}

export interface ChemicalFormData {
  part_number: string;
  lot_number: string;
  description?: string;
  manufacturer?: string;
  quantity: number;
  unit: string;
  location?: string;
  category?: string;
  status?: ChemicalStatus;
  warehouse_id: number;
  expiration_date?: string;
  minimum_stock_level?: number;
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
  work_order?: string;
  notes?: string;
  issue_date: string;
  user_name?: string;
}

export interface ChemicalHistoryEvent {
  id: string | number;
  type: 'created' | 'issuance' | 'child_lot_created';
  chemical_id: number;
  event_date: string;
  description?: string;
  lot_number?: string;
  part_number?: string;
  quantity?: number;
  unit?: string;
  // For issuance events
  hangar?: string;
  purpose?: string;
  work_order?: string;
  notes?: string;
  user_id?: number;
  user_name?: string;
  // For child lot events
  lot_sequence?: number;
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
