// Reports feature types

// ============================================================================
// Common Types
// ============================================================================

export type ReportTimeframe = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export type ExportFormat = 'pdf' | 'excel';

export interface ReportFilters {
  timeframe: ReportTimeframe;
  startDate?: string;
  endDate?: string;
  department?: string;
  category?: string;
  status?: string;
  location?: string;
}

export interface ExportRequest {
  report_type: string;
  report_data: unknown;
  timeframe: ReportTimeframe;
}

// ============================================================================
// Tool Reports
// ============================================================================

export interface ToolInventoryItem {
  id: number;
  tool_number: string;
  serial_number: string;
  description: string;
  category: string;
  location: string;
  status: 'available' | 'checked_out' | 'maintenance' | 'retired';
  condition: string;
  status_reason?: string;
  created_at: string;
}

export interface ToolInventoryReport {
  tools: ToolInventoryItem[];
  summary: {
    total: number;
    available: number;
    checked_out: number;
    maintenance: number;
    retired: number;
  };
  byCategory: Array<{ name: string; value: number }>;
  byLocation: Array<{ name: string; value: number }>;
}

export interface CheckoutHistoryItem {
  id: number;
  tool_id: number;
  tool_number: string;
  serial_number: string;
  description: string;
  category: string;
  user_id: number;
  user_name: string;
  department: string;
  checkout_date: string;
  return_date: string | null;
  expected_return_date: string | null;
  duration: number;
}

export interface CheckoutHistoryReport {
  checkouts: CheckoutHistoryItem[];
  checkoutsByDay: Array<{ date: string; checkouts: number; returns: number }>;
  stats: {
    totalCheckouts: number;
    returnedCheckouts: number;
    currentlyCheckedOut: number;
    averageDuration: number;
  };
}

export interface CalibrationItem {
  id: number;
  tool_id: number;
  tool_number: string;
  serial_number: string;
  description: string;
  category: string;
  calibration_date: string | null;
  calibration_due_date: string | null;
  calibration_status: 'current' | 'due_soon' | 'overdue' | 'not_required';
  calibration_interval_days: number | null;
  last_calibrated_by: string | null;
  days_until_due: number | null;
}

export interface CalibrationReport {
  tools: CalibrationItem[];
  summary: {
    total: number;
    current: number;
    dueSoon: number;
    overdue: number;
    notRequired: number;
  };
  upcomingCalibrations: CalibrationItem[];
  overdueCalibrations: CalibrationItem[];
}

export interface DepartmentUsageData {
  name: string;
  totalCheckouts: number;
  currentlyCheckedOut: number;
  averageDuration: number;
  mostUsedCategory: string;
}

export interface DepartmentUsageReport {
  departments: DepartmentUsageData[];
  checkoutsByDepartment: Array<{ name: string; value: number }>;
  toolUsageByCategory: Array<{ name: string; checkouts: number }>;
}

// ============================================================================
// Chemical Reports
// ============================================================================

export interface ChemicalInventoryItem {
  id: number;
  name: string;
  part_number: string;
  lot_number: string;
  manufacturer: string;
  quantity: number;
  unit: string;
  location: string;
  status: 'available' | 'low_stock' | 'out_of_stock' | 'expired';
  expiration_date: string | null;
  minimum_stock_level: number;
  created_at: string;
}

export interface ChemicalInventoryReport {
  chemicals: ChemicalInventoryItem[];
  summary: {
    total: number;
    totalQuantity: number;
    available: number;
    lowStock: number;
    outOfStock: number;
    expired: number;
  };
  byManufacturer: Array<{ name: string; value: number }>;
  byStatus: Array<{ name: string; value: number; color: string }>;
}

export interface ChemicalExpirationItem {
  id: number;
  name: string;
  part_number: string;
  lot_number: string;
  manufacturer: string;
  quantity: number;
  unit: string;
  location: string;
  expiration_date: string;
  days_until_expiration: number;
  status: 'expired' | 'expiring_soon' | 'ok';
}

export interface ChemicalExpirationReport {
  chemicals: ChemicalExpirationItem[];
  summary: {
    expired: number;
    expiringSoon: number;
    expiring30Days: number;
    expiring60Days: number;
    expiring90Days: number;
  };
  expirationTimeline: Array<{ month: string; count: number }>;
}

export interface ChemicalUsageItem {
  id: number;
  chemical_id: number;
  name: string;
  part_number: string;
  quantity_used: number;
  unit: string;
  used_by: string;
  department: string;
  used_date: string;
  purpose: string;
}

export interface ChemicalUsageReport {
  usage: ChemicalUsageItem[];
  summary: {
    totalUsed: number;
    uniqueChemicals: number;
    topUsers: Array<{ name: string; value: number }>;
  };
  usageByDay: Array<{ date: string; quantity: number }>;
  usageByChemical: Array<{ name: string; value: number }>;
}

export interface ChemicalWasteItem {
  id: number;
  chemical_id: number;
  name: string;
  part_number: string;
  lot_number: string;
  quantity: number;
  unit: string;
  waste_reason: 'expired' | 'contaminated' | 'damaged' | 'other';
  waste_date: string;
  disposed_by: string;
  notes: string;
}

export interface ChemicalWasteReport {
  waste: ChemicalWasteItem[];
  summary: {
    totalWaste: number;
    wasteByReason: Array<{ name: string; value: number }>;
    estimatedCost: number;
  };
  wasteByMonth: Array<{ month: string; quantity: number }>;
}

// ============================================================================
// Kit Reports
// ============================================================================

export interface KitInventoryReportItem {
  kit_id: number;
  kit_name: string;
  aircraft_type: string;
  status: string;
  total_items: number;
  total_expendables: number;
  low_stock_items: number;
  boxes: number;
  last_activity: string | null;
}

export interface KitInventoryReport {
  kits: KitInventoryReportItem[];
  summary: {
    totalKits: number;
    activeKits: number;
    totalItems: number;
    totalExpendables: number;
    lowStockAlerts: number;
  };
  byAircraftType: Array<{ name: string; value: number }>;
}

export interface KitIssuanceReportItem {
  id: number;
  kit_id: number;
  kit_name: string;
  aircraft_type: string;
  item_type: 'item' | 'expendable';
  item_name: string;
  part_number: string;
  quantity: number;
  issued_to: string;
  issued_by: string;
  issued_date: string;
  work_order: string;
  aircraft_tail: string;
  notes: string;
}

export interface KitIssuanceReport {
  issuances: KitIssuanceReportItem[];
  summary: {
    totalIssuances: number;
    uniqueKits: number;
    uniqueItems: number;
    totalQuantity: number;
  };
  issuancesByDay: Array<{ date: string; count: number }>;
  issuancesByKit: Array<{ name: string; value: number }>;
  topItems: Array<{ name: string; value: number }>;
}

export interface KitTransferReportItem {
  id: number;
  source_kit_id: number;
  source_kit_name: string;
  destination_type: 'kit' | 'warehouse';
  destination_id: number;
  destination_name: string;
  item_type: 'item' | 'expendable';
  item_name: string;
  part_number: string;
  quantity: number;
  transferred_by: string;
  transferred_date: string;
  reason: string;
}

export interface KitTransferReport {
  transfers: KitTransferReportItem[];
  summary: {
    totalTransfers: number;
    toKits: number;
    toWarehouse: number;
    uniqueItems: number;
  };
  transfersByDay: Array<{ date: string; count: number }>;
  transfersByKit: Array<{ name: string; outgoing: number; incoming: number }>;
}

export interface KitReorderReportItem {
  id: number;
  kit_id: number;
  kit_name: string;
  aircraft_type: string;
  item_type: 'item' | 'expendable';
  item_name: string;
  part_number: string;
  quantity_requested: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
  requested_by: string;
  requested_date: string;
  approved_by: string | null;
  approved_date: string | null;
  notes: string;
}

export interface KitReorderReport {
  reorders: KitReorderReportItem[];
  summary: {
    totalReorders: number;
    pending: number;
    approved: number;
    ordered: number;
    received: number;
    cancelled: number;
  };
  byPriority: Array<{ name: string; value: number; color: string }>;
  byStatus: Array<{ name: string; value: number }>;
  reordersByMonth: Array<{ month: string; count: number }>;
}

// ============================================================================
// Order Reports
// ============================================================================

export interface ProcurementOrderReportItem {
  id: number;
  order_number: string;
  title: string;
  description: string;
  requester_name: string;
  department: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: string;
  vendor: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  due_date: string | null;
  order_date: string | null;
  delivery_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementOrderReport {
  orders: ProcurementOrderReportItem[];
  summary: {
    total: number;
    new: number;
    inProgress: number;
    ordered: number;
    shipped: number;
    received: number;
    totalEstimatedCost: number;
    totalActualCost: number;
    averageProcessingTime: number;
  };
  byStatus: Array<{ name: string; value: number; color: string }>;
  byPriority: Array<{ name: string; value: number }>;
  ordersByMonth: Array<{ month: string; count: number; cost: number }>;
  topVendors: Array<{ name: string; orders: number; totalCost: number }>;
}

export interface UserRequestReportItem {
  id: number;
  request_number: string;
  requester_name: string;
  department: string;
  status: string;
  total_items: number;
  items_pending: number;
  items_received: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  buyer_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRequestReport {
  requests: UserRequestReportItem[];
  summary: {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    averageCompletionTime: number;
  };
  byStatus: Array<{ name: string; value: number }>;
  byDepartment: Array<{ name: string; value: number }>;
  requestsByMonth: Array<{ month: string; count: number }>;
  topRequesters: Array<{ name: string; requests: number }>;
}

// ============================================================================
// Admin Reports
// ============================================================================

export interface UserActivityItem {
  id: number;
  user_id: number;
  user_name: string;
  employee_number: string;
  department: string;
  action: string;
  resource_type: string;
  resource_id: number | null;
  details: string;
  ip_address: string;
  timestamp: string;
}

export interface UserActivityReport {
  activities: UserActivityItem[];
  summary: {
    totalActivities: number;
    uniqueUsers: number;
    topActions: Array<{ name: string; value: number }>;
  };
  activityByDay: Array<{ date: string; count: number }>;
  activityByUser: Array<{ name: string; value: number }>;
  activityByType: Array<{ name: string; value: number }>;
}

export interface SystemStatsReport {
  users: {
    total: number;
    active: number;
    locked: number;
    newThisMonth: number;
    byDepartment: Array<{ name: string; value: number }>;
  };
  inventory: {
    totalTools: number;
    totalChemicals: number;
    totalKits: number;
    totalWarehouses: number;
    lowStockAlerts: number;
    expirationAlerts: number;
    calibrationAlerts: number;
  };
  orders: {
    totalOrders: number;
    pendingOrders: number;
    lateOrders: number;
    totalRequests: number;
    pendingRequests: number;
  };
  activity: {
    checkoutsToday: number;
    checkoutsThisWeek: number;
    checkoutsThisMonth: number;
    issuancesToday: number;
    issuancesThisWeek: number;
    issuancesThisMonth: number;
  };
}

export interface AuditLogItem {
  id: number;
  user_id: number;
  user_name: string;
  action: string;
  resource_type: string;
  resource_id: number | null;
  old_value: string | null;
  new_value: string | null;
  ip_address: string;
  timestamp: string;
}

export interface AuditLogReport {
  logs: AuditLogItem[];
  summary: {
    total: number;
    creates: number;
    updates: number;
    deletes: number;
  };
  logsByDay: Array<{ date: string; count: number }>;
  logsByAction: Array<{ name: string; value: number }>;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface ReportQueryParams {
  timeframe?: ReportTimeframe;
  start_date?: string;
  end_date?: string;
  department?: string;
  category?: string;
  status?: string;
  location?: string;
  user_id?: number;
  kit_id?: number;
  aircraft_type_id?: number;
}
