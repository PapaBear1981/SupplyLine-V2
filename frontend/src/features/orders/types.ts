// ============================================================================
// Procurement Orders Types
// ============================================================================

export type OrderType = 'tool' | 'chemical' | 'expendable' | 'kit';

export type OrderPriority = 'low' | 'normal' | 'high' | 'critical';

export type OrderStatus =
  | 'new'
  | 'awaiting_info'
  | 'in_progress'
  | 'ordered'
  | 'shipped'
  | 'received'
  | 'cancelled';

export interface ProcurementOrder {
  id: number;
  order_number: string; // ORD-00001 format
  title: string;
  order_type?: OrderType;
  part_number?: string;
  description?: string;
  priority: OrderPriority;
  status: OrderStatus;
  reference_type?: string;
  reference_number?: string;
  tracking_number?: string;
  vendor?: string;
  documentation_path?: string;
  ordered_date?: string; // ISO 8601
  expected_due_date?: string; // ISO 8601
  completed_date?: string; // ISO 8601
  notes?: string;
  quantity?: number;
  unit?: string; // mL, Gallon, each, etc.
  needs_more_info: boolean;
  kit_id?: number;
  requester_id: number;
  buyer_id?: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601

  // Relationships (populated in responses)
  requester?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  buyer?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  kit?: {
    id: number;
    kit_number: string;
    name: string;
  };

  // Calculated fields
  is_late?: boolean;
  days_overdue?: number;
  due_soon?: boolean;
}

export interface ProcurementOrderMessage {
  id: number;
  order_id: number;
  sender_id: number;
  recipient_id?: number;
  subject: string;
  message: string;
  is_read: boolean;
  sent_date: string; // ISO 8601
  read_date?: string; // ISO 8601
  parent_message_id?: number;
  attachments?: string;

  // Relationships
  sender?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  recipient?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  replies?: ProcurementOrderMessage[];
}

export interface CreateOrderRequest {
  title: string;
  order_type?: OrderType;
  part_number?: string;
  description?: string;
  priority?: OrderPriority;
  status?: OrderStatus;
  reference_type?: string;
  reference_number?: string;
  tracking_number?: string;
  expected_due_date?: string;
  notes?: string;
  quantity?: number;
  unit?: string;
  needs_more_info?: boolean;
  kit_id?: number;
  requester_id?: number;
  buyer_id?: number;
  documentation?: File;
}

export interface UpdateOrderRequest {
  title?: string;
  order_type?: OrderType;
  part_number?: string;
  description?: string;
  priority?: OrderPriority;
  status?: OrderStatus;
  reference_type?: string;
  reference_number?: string;
  tracking_number?: string;
  vendor?: string;
  expected_due_date?: string;
  notes?: string;
  quantity?: number;
  unit?: string;
  needs_more_info?: boolean;
  buyer_id?: number;
}

export interface MarkOrderedRequest {
  vendor?: string;
  tracking_number?: string;
  ordered_date?: string;
}

export interface MarkDeliveredRequest {
  received_quantity?: number;
}

export interface OrdersListParams {
  status?: string; // Comma-separated
  order_type?: string; // Comma-separated
  priority?: string; // Comma-separated
  buyer_id?: number;
  requester_id?: number;
  search?: string;
  due_after?: string; // ISO 8601
  due_before?: string; // ISO 8601
  is_late?: boolean;
  sort?: 'due_date' | 'created';
  limit?: number;
}

export interface OrderAnalytics {
  status_breakdown: Record<OrderStatus, number>;
  priority_breakdown: Record<OrderPriority, number>;
  type_breakdown: Record<OrderType, number>;
  late_count: number;
  due_soon_count: number;
  avg_open_days: number;
  total_count: number;
}

export interface CreateOrderMessageRequest {
  recipient_id?: number;
  subject: string;
  message: string;
  parent_message_id?: number;
}

// ============================================================================
// User Requests Types
// ============================================================================

export type RequestStatus =
  | 'new'
  | 'awaiting_info'
  | 'in_progress'
  | 'partially_ordered'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export type RequestPriority = 'low' | 'normal' | 'high' | 'critical';

export type ItemType = 'tool' | 'chemical' | 'expendable' | 'other';

export type ItemStatus = 'pending' | 'ordered' | 'shipped' | 'received' | 'cancelled';

export type SourceType = 'manual' | 'chemical_reorder' | 'kit_reorder';

export interface UserRequest {
  id: number;
  request_number: string; // REQ-00001 format
  title: string;
  description?: string;
  priority: RequestPriority;
  status: RequestStatus;
  requester_id: number;
  buyer_id?: number;
  notes?: string;
  needs_more_info: boolean;
  expected_due_date?: string; // ISO 8601
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601

  // Relationships
  requester?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  buyer?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  items?: RequestItem[];

  // Calculated fields
  is_late?: boolean;
  days_overdue?: number;
  due_soon?: boolean;
  item_count?: number;
}

export interface RequestItem {
  id: number;
  request_id: number;
  item_type: ItemType;
  part_number?: string;
  description: string;
  quantity: number;
  unit: string;
  status: ItemStatus;
  source_type?: SourceType;
  chemical_id?: number;
  kit_id?: number;
  kit_reorder_request_id?: number;
  vendor?: string;
  tracking_number?: string;
  ordered_date?: string; // ISO 8601
  expected_delivery_date?: string; // ISO 8601
  received_date?: string; // ISO 8601
  received_quantity?: number;
  order_notes?: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601

  // Relationships
  chemical?: {
    id: number;
    name: string;
    part_number?: string;
  };
  kit?: {
    id: number;
    kit_number: string;
    name: string;
  };
}

export interface CreateRequestRequest {
  title: string;
  description?: string;
  priority?: RequestPriority;
  notes?: string;
  expected_due_date?: string;
  items: CreateRequestItemRequest[];
}

export interface CreateRequestItemRequest {
  description: string;
  item_type?: ItemType;
  part_number?: string;
  quantity?: number;
  unit?: string;
}

export interface UpdateRequestRequest {
  title?: string;
  description?: string;
  priority?: RequestPriority;
  notes?: string;
  needs_more_info?: boolean;
  expected_due_date?: string;
  buyer_id?: number;
}

export interface UpdateRequestItemRequest {
  vendor?: string;
  tracking_number?: string;
  expected_delivery_date?: string;
  order_notes?: string;
  status?: ItemStatus;
}

export interface MarkItemsOrderedRequest {
  items: {
    item_id: number;
    vendor?: string;
    tracking_number?: string;
    expected_delivery_date?: string;
    order_notes?: string;
  }[];
}

export interface MarkItemsReceivedRequest {
  item_ids: number[];
}

export interface CancelItemsRequest {
  item_ids: number[];
  cancellation_reason: string;
}

export interface RequestsListParams {
  status?: string; // Comma-separated
  priority?: string; // Comma-separated
  buyer_id?: number;
  requester_id?: number;
  search?: string;
  needs_more_info?: boolean;
  due_after?: string; // ISO 8601
  due_before?: string; // ISO 8601
  is_late?: boolean;
  sort?: 'created' | 'due_date';
  limit?: number;
}

export interface RequestAnalytics {
  status_breakdown: Record<RequestStatus, number>;
  priority_breakdown: Record<RequestPriority, number>;
  late_count: number;
  due_soon_count: number;
  avg_open_days: number;
  total_count: number;
  total_items: number;
}

export interface UserRequestMessage {
  id: number;
  request_id: number;
  sender_id: number;
  recipient_id?: number;
  subject: string;
  message: string;
  is_read: boolean;
  sent_date: string; // ISO 8601
  read_date?: string; // ISO 8601
  parent_message_id?: number;
  attachments?: string;

  // Relationships
  sender?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  recipient?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  replies?: UserRequestMessage[];
}

export interface CreateRequestMessageRequest {
  recipient_id?: number;
  subject: string;
  message: string;
  parent_message_id?: number;
}

// ============================================================================
// Kit Reorder Requests Types
// ============================================================================

export type KitReorderPriority = 'low' | 'medium' | 'high' | 'urgent';

export type KitReorderStatus = 'pending' | 'approved' | 'ordered' | 'fulfilled' | 'cancelled';

export type KitItemType = 'tool' | 'chemical' | 'expendable';

export interface KitReorderRequest {
  id: number;
  kit_id: number;
  item_type: KitItemType;
  item_id?: number;
  part_number: string;
  description: string;
  quantity_requested: number;
  priority: KitReorderPriority;
  requested_by: number;
  requested_date: string; // ISO 8601
  status: KitReorderStatus;
  approved_by?: number;
  approved_date?: string; // ISO 8601
  fulfillment_date?: string; // ISO 8601
  notes?: string;
  is_automatic: boolean;
  image_path?: string;

  // Relationships
  kit?: {
    id: number;
    kit_number: string;
    name: string;
  };
  requester?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  approver?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface CreateKitReorderRequest {
  item_type: KitItemType;
  item_id?: number;
  part_number: string;
  description: string;
  quantity_requested: number;
  priority?: KitReorderPriority;
  notes?: string;
  image?: File;
}

export interface UpdateKitReorderRequest {
  part_number?: string;
  description?: string;
  quantity_requested?: number;
  priority?: KitReorderPriority;
  notes?: string;
}

export interface KitReordersListParams {
  kit_id?: number;
  status?: string; // Comma-separated
  priority?: string; // Comma-separated
  item_type?: string; // Comma-separated
  requested_by?: number;
  is_automatic?: boolean;
  limit?: number;
}
