// ============================================================================
// Phase 2: Operational workflow types
// ============================================================================

/** Phase 2 request priorities (operational language) */
export type RequestPriorityV2 = 'routine' | 'urgent' | 'aog';

/** Phase 2 request statuses (mechanics see these summarized statuses) */
export type RequestStatusV2 =
  | 'new'
  | 'under_review'
  | 'pending_fulfillment'
  | 'in_transfer'
  | 'awaiting_external_procurement'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'needs_info'
  | 'cancelled';

/** Phase 2 request types */
export type RequestType =
  | 'manual'
  | 'kit_replenishment'
  | 'warehouse_replenishment'
  | 'transfer'
  | 'repairable_return';

/** Phase 2 source trigger */
export type SourceTrigger =
  | 'manual'
  | 'kit_issuance'
  | 'low_stock'
  | 'transfer'
  | 'return_obligation';

/** Phase 2 destination type */
export type DestinationType = 'mobile_kit' | 'warehouse' | 'person_team' | 'base_location';

/** Phase 2 item class */
export type ItemClass = 'tool' | 'part' | 'chemical' | 'expendable' | 'repairable' | 'other';

/** Phase 2 repairable/core return status */
export type ReturnStatus =
  | 'issued_core_expected'
  | 'in_return_transit'
  | 'returned_to_stores'
  | 'closed';

/** Phase 2 fulfillment action type */
export type FulfillmentActionType =
  | 'stock_fulfillment'
  | 'transfer'
  | 'kit_replenishment'
  | 'external_procurement'
  | 'return_tracking';

/** Phase 2 fulfillment statuses (fulfillment staff see these) */
export type FulfillmentStatus =
  | 'new'
  | 'assigned'
  | 'sourcing'
  | 'in_transfer'
  | 'awaiting_external_procurement'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'closed'
  | 'cancelled'
  // Legacy values (backward compat)
  | 'awaiting_info'
  | 'in_progress'
  | 'ordered'
  | 'shipped'
  | 'received';

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
  | 'cancelled'
  // Phase 2 fulfillment statuses (used in analytics breakdown)
  | 'assigned'
  | 'sourcing'
  | 'in_transfer'
  | 'fulfilled'
  | 'closed';

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

  // Flat name fields (from to_dict())
  buyer_name?: string;
  requester_name?: string;

  // Calculated fields
  is_late?: boolean;
  days_overdue?: number;
  due_soon?: boolean;

  // Phase 2: fulfillment-action fields
  request_id?: number;
  source_location?: string;
  fulfillment_action_type?: FulfillmentActionType;
  fulfillment_quantity?: number;
  is_internal_fulfillment?: boolean;
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
  // Phase 2 fulfillment-action fields
  request_id?: number;
  source_location?: string;
  fulfillment_action_type?: FulfillmentActionType;
  fulfillment_quantity?: number;
  is_internal_fulfillment?: boolean;
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
  // Phase 2 fulfillment-action fields
  request_id?: number;
  source_location?: string;
  fulfillment_action_type?: FulfillmentActionType;
  fulfillment_quantity?: number;
  is_internal_fulfillment?: boolean;
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
  // Phase 2 statuses (operational language — mechanics see these)
  | 'new'
  | 'under_review'
  | 'pending_fulfillment'
  | 'in_transfer'
  | 'awaiting_external_procurement'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'needs_info'
  | 'cancelled'
  // Legacy statuses (backward compat with existing data)
  | 'awaiting_info'
  | 'in_progress'
  | 'partially_ordered'
  | 'ordered'
  | 'partially_received'
  | 'received';

/** Phase 2 operational priorities. Legacy values accepted for backward compat. */
export type RequestPriority =
  | 'routine'
  | 'urgent'
  | 'aog'
  // Legacy values
  | 'low'
  | 'normal'
  | 'high'
  | 'critical';

export type ItemType = 'tool' | 'chemical' | 'expendable' | 'repairable' | 'other';

export type ItemStatus = 'pending' | 'ordered' | 'shipped' | 'received' | 'cancelled' | 'fulfilled' | 'in_transfer';

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

  // Flat name fields (from to_dict())
  requester_name?: string;
  buyer_name?: string;

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
  fulfillment_action_count?: number;

  // Phase 2 operational context fields
  request_type?: RequestType;
  source_trigger?: SourceTrigger;
  destination_type?: DestinationType;
  destination_location?: string;
  related_kit_id?: number;
  item_class?: ItemClass;
  repairable?: boolean;
  core_required?: boolean;
  return_status?: ReturnStatus;
  return_destination?: string;
  external_reference?: string;
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
  procurement_order_id?: number;
  vendor?: string;
  tracking_number?: string;
  ordered_date?: string; // ISO 8601
  expected_delivery_date?: string; // ISO 8601
  received_date?: string; // ISO 8601
  received_quantity?: number;
  unit_cost?: number;
  total_cost?: number;
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
  request?: {
    id: number;
    request_number: string;
    title: string;
  };
}

export interface CreateRequestRequest {
  title: string;
  description?: string;
  priority?: RequestPriority;
  notes?: string;
  expected_due_date?: string;
  items: CreateRequestItemRequest[];
  // Phase 2 operational context
  request_type?: RequestType;
  source_trigger?: SourceTrigger;
  destination_type?: DestinationType;
  destination_location?: string;
  related_kit_id?: number;
  item_class?: ItemClass;
  repairable?: boolean;
  core_required?: boolean;
  external_reference?: string;
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
  status?: RequestStatus;
  notes?: string;
  needs_more_info?: boolean;
  expected_due_date?: string;
  buyer_id?: number;
  // Phase 2 operational context
  request_type?: RequestType;
  source_trigger?: SourceTrigger;
  destination_type?: DestinationType;
  destination_location?: string;
  related_kit_id?: number;
  item_class?: ItemClass;
  repairable?: boolean;
  core_required?: boolean;
  return_status?: ReturnStatus;
  return_destination?: string;
  external_reference?: string;
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
  // Phase 2 filters
  request_type?: string; // Comma-separated
  repairable?: boolean;
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
// Request Timeline Types
// ============================================================================

export type RequestTimelineEventType =
  | 'created'
  | 'status_changed'
  | 'buyer_assigned'
  | 'items_ordered'
  | 'items_received'
  | 'items_cancelled'
  | 'cancelled'
  | 'message_sent';

export interface RequestTimelineEvent {
  event_type: RequestTimelineEventType;
  timestamp: string; // ISO 8601
  user_id?: number;
  user_name: string;
  description: string;
  details: Record<string, unknown>;
}

export interface RequestTimelineResponse {
  timeline: RequestTimelineEvent[];
  total: number;
  request_number: string;
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
