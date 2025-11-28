// Tool Checkout System Types

// Checkout status
export type CheckoutStatus = 'checked_out' | 'returned';

// Condition options
export type ToolCondition = 'New' | 'Good' | 'Fair' | 'Poor' | 'Damaged';

// Damage severity levels
export type DamageSeverity = 'minor' | 'moderate' | 'severe' | 'unusable';

// Tool history event types
export type ToolHistoryEventType =
  | 'checkout'
  | 'return'
  | 'damage_reported'
  | 'damage_resolved'
  | 'calibration'
  | 'maintenance_start'
  | 'maintenance_end'
  | 'repair'
  | 'status_change'
  | 'location_change'
  | 'condition_change'
  | 'created'
  | 'retired'
  | 'checkout_extended';

// Enhanced Checkout interface
export interface ToolCheckout {
  id: number;
  tool_id: number;
  user_id: number;
  checkout_date: string;
  return_date: string | null;
  expected_return_date: string | null;
  checkout_notes: string | null;
  condition_at_checkout: ToolCondition | null;
  work_order: string | null;
  project: string | null;
  return_notes: string | null;
  condition_at_return: ToolCondition | null;
  checked_in_by_id: number | null;
  damage_reported: boolean;
  damage_description: string | null;
  damage_severity: DamageSeverity | null;
  damage_reported_date: string | null;
  status: CheckoutStatus;
  is_overdue: boolean;
  days_overdue: number;
  created_at: string | null;
  updated_at: string | null;

  // Related data (when included)
  tool_number?: string;
  serial_number?: string;
  tool_description?: string;
  tool_category?: string;
  user_name?: string;
  user_employee_number?: string;
  user_department?: string;
  checked_in_by_name?: string;
}

// Tool availability check response
export interface ToolAvailability {
  tool_id: number;
  tool_number: string;
  serial_number: string;
  available: boolean;
  blocking_reasons: {
    reason: string;
    message: string;
    checkout_id?: number;
    checkout_date?: string;
    expected_return_date?: string;
    next_calibration_date?: string;
  }[];
  warnings: {
    type: string;
    message: string;
    next_calibration_date?: string;
  }[];
  current_status: string;
  condition: string;
  calibration_status: string;
}

// Tool history event
export interface ToolHistoryEvent {
  id: number;
  tool_id: number;
  event_type: ToolHistoryEventType;
  event_date: string;
  user_id: number;
  user_name: string;
  description: string;
  details: Record<string, unknown> | null;
  related_checkout_id: number | null;
  related_calibration_id: number | null;
  related_service_record_id: number | null;
  old_status: string | null;
  new_status: string | null;
  old_condition: string | null;
  new_condition: string | null;
  created_at: string;
}

// Tool search result for checkout
export interface ToolSearchResult {
  id: number;
  tool_number: string;
  serial_number: string;
  description: string;
  category: string;
  condition: string;
  status: string;
  calibration_status: string;
  available: boolean;
  checked_out_to: string | null;
}

// Checkout statistics
export interface CheckoutStats {
  active_checkouts: number;
  overdue_checkouts: number;
  checkouts_today: number;
  returns_today: number;
  checkouts_this_week: number;
  checkouts_this_month: number;
  damage_reports_this_month: number;
  popular_tools: {
    id: number;
    tool_number: string;
    description: string;
    checkout_count: number;
  }[];
  active_users: {
    id: number;
    name: string;
    department: string;
    checkout_count: number;
  }[];
}

// API request types
export interface CheckoutRequest {
  tool_id: number;
  user_id?: number;
  expected_return_date?: string;
  notes?: string;
  condition_at_checkout?: ToolCondition;
  work_order?: string;
  project?: string;
}

export interface CheckinRequest {
  condition_at_return?: ToolCondition;
  return_notes?: string;
  damage_reported?: boolean;
  damage_description?: string;
  damage_severity?: DamageSeverity;
}

export interface ReportDamageRequest {
  damage_description: string;
  damage_severity?: DamageSeverity;
}

export interface ExtendCheckoutRequest {
  new_expected_return_date: string;
  reason?: string;
}

// API response types
export interface CheckoutListResponse {
  checkouts: ToolCheckout[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ToolTimelineResponse {
  tool: {
    id: number;
    tool_number: string;
    serial_number: string;
    description: string;
    status: string;
    condition: string;
    calibration_status: string;
  };
  timeline: ToolHistoryEvent[];
  stats: {
    total_checkouts: number;
    active_checkout: boolean;
    damage_reports: number;
    calibrations: number;
    service_records: number;
  };
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// Query params
export interface CheckoutQueryParams {
  page?: number;
  per_page?: number;
  q?: string;
  department?: string;
  overdue_only?: boolean;
  include_returned?: boolean;
}

export interface TimelineQueryParams {
  page?: number;
  per_page?: number;
  event_type?: ToolHistoryEventType;
}
