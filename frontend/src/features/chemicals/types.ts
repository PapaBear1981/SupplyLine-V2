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
  warehouse_id?: number;
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

export type ForecastUrgency = 'critical' | 'soon' | 'expiry_risk' | 'ok' | 'no_data';

export interface ChemicalForecastRow {
  part_number: string;
  description: string;
  manufacturer?: string | null;
  lot_count: number;
  current_quantity: number;
  unit: string;
  daily_consumption_rate: number;
  weekly_consumption_rate: number;
  net_issued_in_window: number;
  analysis_window_days: number;
  days_of_stock_remaining: number | null;
  projected_depletion_date: string | null;
  earliest_expiry_date: string | null;
  days_until_expiry: number | null;
  waste_risk_quantity: number;
  urgency: ForecastUrgency;
  recommended_order_quantity: number | null;
  needs_reorder: boolean;
  current_reorder_status: string | null;
  chemical_ids: number[];
}

export interface ChemicalForecastSummary {
  total_part_numbers: number;
  critical: number;
  reorder_soon: number;
  expiry_risk: number;
  ok: number;
  no_history: number;
  total_waste_risk_qty: number;
}

export interface ChemicalForecastParams {
  analysis_days?: number;
  lead_time_days?: number;
  safety_stock_days?: number;
}

export interface ChemicalForecastResponse {
  forecasts: ChemicalForecastRow[];
  summary: ChemicalForecastSummary;
  parameters: {
    analysis_window_days: number;
    lead_time_days: number;
    safety_stock_days: number;
  };
  generated_at: string;
}
