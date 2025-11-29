// Kit status types
export type KitStatus = 'active' | 'inactive' | 'maintenance' | 'deployed' | 'retired';
export type BoxType = 'expendable' | 'tooling' | 'consumable' | 'loose' | 'floor';
export type ItemType = 'tool' | 'chemical' | 'expendable';
export type ItemStatus = 'available' | 'issued' | 'maintenance' | 'low_stock' | 'out_of_stock';
export type TrackingType = 'lot' | 'serial' | 'none';
export type TransferStatus = 'pending' | 'completed' | 'cancelled';
export type ReorderStatus = 'pending' | 'approved' | 'ordered' | 'fulfilled' | 'cancelled';
export type ReorderPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LocationType = 'kit' | 'warehouse';

// Aircraft Type
export interface AircraftType {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  kit_count?: number;
}

// Kit
export interface Kit {
  id: number;
  name: string;
  aircraft_type_id: number;
  aircraft_type_name?: string;
  description?: string;
  status: KitStatus;
  created_at: string;
  updated_at: string;
  created_by: number;
  creator_name?: string;
  box_count?: number;
  item_count?: number;
  boxes?: KitBox[];
  pending_reorders?: number;
  unread_messages?: number;
  // Location fields
  location_address?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  location_zip?: string | null;
  location_country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_notes?: string | null;
  has_location?: boolean;
}

// Kit Location (for map display)
export interface KitLocation {
  id: number;
  name: string;
  status: KitStatus;
  aircraft_type_id: number;
  aircraft_type_name?: string;
  description?: string;
  location_address?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  location_zip?: string | null;
  location_country?: string | null;
  latitude: number | null;
  longitude: number | null;
  location_notes?: string | null;
  full_address?: string | null;
  has_location: boolean;
  box_count?: number;
  item_count?: number;
}

export interface KitLocationsResponse {
  kits: KitLocation[];
  total: number;
  with_location: number;
  without_location: number;
}

export interface KitLocationFormData {
  location_address?: string;
  location_city?: string;
  location_state?: string;
  location_zip?: string;
  location_country?: string;
  latitude?: number;
  longitude?: number;
  location_notes?: string;
}

// Kit Box
export interface KitBox {
  id: number;
  kit_id: number;
  box_number: string;
  box_type: BoxType;
  description?: string;
  created_at: string;
  item_count?: number;
}

// Kit Item (tools and chemicals from warehouse)
export interface KitItem {
  id: number;
  kit_id: number;
  box_id: number;
  box_number?: string;
  item_type: ItemType;
  item_id: number;
  part_number?: string;
  serial_number?: string;
  lot_number?: string;
  description: string;
  quantity: number;
  location?: string;
  status: ItemStatus;
  added_date: string;
  last_updated: string;
  // Additional fields for expendables from main inventory
  manufacturer?: string;
  unit?: string;
  category?: string;
  minimum_stock_level?: number;
  tracking_type?: TrackingType;
  source?: 'item' | 'expendable'; // Indicates if from KitItem or KitExpendable table
  kit_item_id?: number;
  expendable_id?: number;
}

// Kit Expendable (manually added items)
export interface KitExpendable {
  id: number;
  kit_id: number;
  box_id: number;
  box_number?: string;
  part_number: string;
  serial_number?: string;
  lot_number?: string;
  tracking_type: TrackingType;
  description: string;
  quantity: number;
  unit: string;
  location?: string;
  status: ItemStatus;
  minimum_stock_level?: number;
  is_low_stock?: boolean;
  added_date: string;
  last_updated: string;
  source?: 'item' | 'expendable';
}

// Kit Issuance
export interface KitIssuance {
  id: number;
  kit_id: number;
  kit_name?: string;
  item_type: ItemType;
  item_id: number;
  issued_by: number;
  issuer_name?: string;
  issued_to?: number;
  recipient_name?: string;
  part_number?: string;
  serial_number?: string;
  lot_number?: string;
  description: string;
  quantity: number;
  purpose?: string;
  work_order?: string;
  issued_date: string;
  notes?: string;
}

// Kit Transfer
export interface KitTransfer {
  id: number;
  item_type: ItemType;
  item_id: number;
  from_location_type: LocationType;
  from_location_id: number;
  from_location_name?: string;
  to_location_type: LocationType;
  to_location_id: number;
  to_location_name?: string;
  quantity: number;
  transferred_by: number;
  transferred_by_name?: string;
  transfer_date: string;
  status: TransferStatus;
  completed_date?: string;
  notes?: string;
  // Item details
  part_number?: string;
  tool_number?: string;
  description?: string;
  lot_number?: string;
  serial_number?: string;
}

// Kit Reorder Request
export interface KitReorderRequest {
  id: number;
  kit_id: number;
  kit_name?: string;
  item_type: ItemType;
  item_id?: number;
  part_number: string;
  description: string;
  quantity_requested: number;
  priority: ReorderPriority;
  requested_by: number;
  requester_name?: string;
  requested_date: string;
  status: ReorderStatus;
  order_status?: string;
  approved_by?: number;
  approver_name?: string;
  approved_date?: string;
  fulfillment_date?: string;
  notes?: string;
  is_automatic: boolean;
  image_path?: string;
  message_count?: number;
}

// Kit Message
export interface KitMessage {
  id: number;
  kit_id: number;
  kit_name?: string;
  related_request_id?: number;
  sender_id: number;
  sender_name?: string;
  recipient_id?: number;
  recipient_name?: string;
  subject: string;
  message: string;
  is_read: boolean;
  sent_date: string;
  read_date?: string;
  parent_message_id?: number;
  attachments?: string;
  reply_count?: number;
  replies?: KitMessage[];
}

// Kit Analytics
export interface KitAnalytics {
  kit_id: number;
  kit_name: string;
  period_days: number;
  issuances: {
    total: number;
    average_per_day: number;
  };
  transfers: {
    incoming: number;
    outgoing: number;
    net: number;
  };
  reorders: {
    pending: number;
    fulfilled: number;
  };
  inventory: {
    total_items: number;
    low_stock_items: number;
    stock_health: 'good' | 'warning' | 'critical';
  };
}

// Kit Alert
export interface KitAlert {
  type: 'low_stock' | 'pending_reorders' | 'unread_messages';
  severity: 'low' | 'medium' | 'high';
  item_type?: ItemType;
  item_id?: number;
  part_number?: string;
  description?: string;
  current_quantity?: number;
  minimum_quantity?: number;
  count?: number;
  message: string;
}

export interface KitAlertResponse {
  kit_id: number;
  kit_name: string;
  alert_count: number;
  alerts: KitAlert[];
}

// Form data types
export interface KitFormData {
  name: string;
  aircraft_type_id: number;
  description?: string;
  status?: KitStatus;
  boxes?: {
    box_number: string;
    box_type: BoxType;
    description?: string;
  }[];
}

export interface KitBoxFormData {
  box_number: string;
  box_type: BoxType;
  description?: string;
}

export interface KitItemFormData {
  box_id: number;
  item_type: ItemType;
  item_id: number;
  warehouse_id?: number;
  quantity?: number;
  location?: string;
  notes?: string;
}

export interface KitExpendableFormData {
  box_id: number;
  part_number: string;
  serial_number?: string;
  lot_number?: string;
  tracking_type?: TrackingType;
  description: string;
  quantity: number;
  unit?: string;
  location?: string;
  minimum_stock_level?: number;
}

export interface KitIssuanceFormData {
  item_type: ItemType;
  item_id: number;
  quantity: number;
  purpose?: string;
  work_order?: string;
  notes?: string;
}

export interface KitTransferFormData {
  item_type: ItemType;
  item_id: number;
  from_location_type: LocationType;
  from_location_id: number;
  to_location_type: LocationType;
  to_location_id: number;
  quantity: number;
  notes?: string;
}

export interface KitReorderFormData {
  item_type: ItemType;
  item_id?: number;
  part_number: string;
  description: string;
  quantity_requested: number;
  priority: ReorderPriority;
  notes?: string;
  image_path?: string;
}

// Query params
export interface KitsQueryParams {
  status?: KitStatus;
  aircraft_type_id?: number;
}

export interface KitItemsQueryParams {
  box_id?: number;
  item_type?: ItemType;
  status?: ItemStatus;
}

export interface KitExpendablesQueryParams {
  box_id?: number;
  status?: ItemStatus;
  page?: number;
  per_page?: number;
}

// API Response types
export interface KitItemsResponse {
  items: KitItem[];
  expendables: KitItem[];
  total_count: number;
}

export interface KitExpendablesResponse {
  expendables: KitExpendable[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Wizard types
export interface KitWizardStep1Response {
  step: 1;
  aircraft_types: AircraftType[];
  next_step: 2;
}

export interface KitWizardStep2Response {
  step: 2;
  valid: boolean;
  next_step: 3;
}

export interface KitWizardStep3Response {
  step: 3;
  suggested_boxes: {
    box_number: string;
    box_type: BoxType;
    description: string;
  }[];
  next_step: 4;
}

export interface KitWizardStep4Response {
  step: 4;
  complete: true;
  kit: Kit;
}

export type KitWizardResponse =
  | KitWizardStep1Response
  | KitWizardStep2Response
  | KitWizardStep3Response
  | KitWizardStep4Response;

// Recent Activity
export interface KitActivity {
  id: string;
  type: 'issuance' | 'transfer' | 'reorder';
  description: string;
  kit_name: string;
  kit_id: number;
  details: string;
  user_name: string;
  timestamp: string;
  created_at: string;
  status?: string;
}
