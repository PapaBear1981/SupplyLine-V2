// Dashboard-specific types

export interface DashboardStats {
  tools: {
    total: number;
    available: number;
    checkedOut: number;
    maintenance: number;
    calibrationDue: number;
    calibrationOverdue: number;
  };
  chemicals: {
    total: number;
    available: number;
    lowStock: number;
    outOfStock: number;
    expired: number;
    expiringSoon: number;
  };
  kits: {
    total: number;
    active: number;
    lowStockItems: number;
    pendingReorders: number;
  };
  warehouses: {
    total: number;
  };
  users: {
    total: number;
    active: number;
    locked: number;
  };
}

export interface DashboardAlert {
  id: string;
  type: 'low_stock' | 'calibration_due' | 'calibration_overdue' | 'expired' | 'expiring_soon' | 'pending_reorder' | 'announcement';
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  count?: number;
  link?: string;
  timestamp?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface ActivityTimelineData {
  date: string;
  issuances: number;
  transfers: number;
}
