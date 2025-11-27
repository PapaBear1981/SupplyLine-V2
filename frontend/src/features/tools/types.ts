// Tool status types
export type ToolStatus = 'available' | 'checked_out' | 'maintenance' | 'retired';
export type CalibrationStatus = 'current' | 'due_soon' | 'overdue' | 'not_applicable';

// Main Tool interface
export interface Tool {
  id: number;
  tool_number: string;
  serial_number: string;
  lot_number?: string | null;
  description: string;
  condition: string;
  location: string;
  category: string;
  status: ToolStatus;
  status_reason?: string | null;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  created_at: string;

  // Calibration fields
  requires_calibration: boolean;
  calibration_frequency_days?: number | null;
  last_calibration_date?: string | null;
  next_calibration_date?: string | null;
  calibration_status: CalibrationStatus;

  // Kit information (if tool is in a kit)
  kit_id?: number | null;
  kit_name?: string | null;
  box_id?: number | null;
  box_number?: string | null;
}

// Tool creation/update request
export interface ToolFormData {
  tool_number: string;
  serial_number: string;
  lot_number?: string;
  description: string;
  condition: string;
  location: string;
  category?: string;
  status?: ToolStatus;
  status_reason?: string;
  warehouse_id?: number;

  // Calibration fields
  requires_calibration?: boolean;
  calibration_frequency_days?: number;
  last_calibration_date?: string;
  next_calibration_date?: string;
}

// API response types
export interface ToolsListResponse {
  tools: Tool[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ToolsQueryParams {
  page?: number;
  per_page?: number;
  q?: string; // search query
  status?: ToolStatus;
  category?: string;
  warehouse_id?: number;
  calibration_status?: CalibrationStatus;
}

// Calibration history
export interface ToolCalibration {
  id: number;
  tool_id: number;
  calibration_date: string;
  next_calibration_date: string;
  calibrated_by: string;
  calibration_standard?: string;
  certificate_number?: string;
  notes?: string;
  certificate_path?: string;
  created_at: string;
}

// Service history
export interface ToolServiceRecord {
  id: number;
  tool_id: number;
  service_date: string;
  service_type: string;
  description: string;
  performed_by: string;
  cost?: number;
  created_at: string;
}

// Checkout information
export interface ToolCheckout {
  id: number;
  tool_id: number;
  user_id: number;
  user_name: string;
  checkout_date: string;
  return_date?: string | null;
  notes?: string;
}
