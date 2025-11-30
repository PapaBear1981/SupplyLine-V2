import { ROUTES } from '@shared/constants/routes';
import type { DashboardAlert } from '../types';

export interface ToolStats {
  total: number;
  available: number;
  checkedOut: number;
  maintenance: number;
  calibrationDue: number;
  calibrationOverdue: number;
}

export interface ChemicalStats {
  total: number;
  available: number;
  lowStock: number;
  outOfStock: number;
  expired: number;
  expiringSoon: number;
}

export interface KitStats {
  total: number;
  active: number;
  pendingReorders: number;
}

interface BuildAlertsParams {
  toolStats: ToolStats;
  chemicalStats: ChemicalStats;
  kitStats: KitStats;
}

export const buildDashboardAlerts = ({
  toolStats,
  chemicalStats,
  kitStats,
}: BuildAlertsParams): DashboardAlert[] => {
  const alerts: DashboardAlert[] = [];

  if (toolStats.calibrationOverdue > 0) {
    alerts.push({
      id: 'calibration-overdue',
      type: 'calibration_overdue',
      severity: 'error',
      title: 'Calibration Overdue',
      description: `${toolStats.calibrationOverdue} tool(s) have overdue calibration that requires immediate attention.`,
      count: toolStats.calibrationOverdue,
      link: ROUTES.TOOLS + '?calibration_status=overdue',
    });
  }

  if (chemicalStats.expired > 0) {
    alerts.push({
      id: 'chemicals-expired',
      type: 'expired',
      severity: 'error',
      title: 'Expired Chemicals',
      description: `${chemicalStats.expired} chemical(s) have expired and should be disposed of properly.`,
      count: chemicalStats.expired,
      link: ROUTES.CHEMICALS + '?status=expired',
    });
  }

  if (chemicalStats.outOfStock > 0) {
    alerts.push({
      id: 'chemicals-oos',
      type: 'low_stock',
      severity: 'error',
      title: 'Out of Stock',
      description: `${chemicalStats.outOfStock} chemical(s) are completely out of stock.`,
      count: chemicalStats.outOfStock,
      link: ROUTES.CHEMICALS + '?status=out_of_stock',
    });
  }

  if (chemicalStats.lowStock > 0) {
    alerts.push({
      id: 'chemicals-low',
      type: 'low_stock',
      severity: 'warning',
      title: 'Low Stock Warning',
      description: `${chemicalStats.lowStock} chemical(s) are running low on stock.`,
      count: chemicalStats.lowStock,
      link: ROUTES.CHEMICALS + '?status=low_stock',
    });
  }

  if (toolStats.calibrationDue > 0) {
    alerts.push({
      id: 'calibration-due',
      type: 'calibration_due',
      severity: 'warning',
      title: 'Calibration Due Soon',
      description: `${toolStats.calibrationDue} tool(s) have calibration due within the next 30 days.`,
      count: toolStats.calibrationDue,
      link: ROUTES.TOOLS + '?calibration_status=due_soon',
    });
  }

  if (chemicalStats.expiringSoon > 0) {
    alerts.push({
      id: 'chemicals-expiring',
      type: 'expiring_soon',
      severity: 'warning',
      title: 'Chemicals Expiring Soon',
      description: `${chemicalStats.expiringSoon} chemical(s) will expire within 30 days.`,
      count: chemicalStats.expiringSoon,
      link: ROUTES.CHEMICALS,
    });
  }

  if (kitStats.pendingReorders > 0) {
    alerts.push({
      id: 'pending-reorders',
      type: 'pending_reorder',
      severity: 'info',
      title: 'Pending Reorder Requests',
      description: `${kitStats.pendingReorders} reorder request(s) are awaiting approval.`,
      count: kitStats.pendingReorders,
      link: ROUTES.KITS,
    });
  }

  if (toolStats.maintenance > 0) {
    alerts.push({
      id: 'tools-maintenance',
      type: 'low_stock',
      severity: 'info',
      title: 'Tools in Maintenance',
      description: `${toolStats.maintenance} tool(s) are currently undergoing maintenance.`,
      count: toolStats.maintenance,
      link: ROUTES.TOOLS + '?status=maintenance',
    });
  }

  if (toolStats.checkedOut > 0) {
    alerts.push({
      id: 'tools-checked-out',
      type: 'pending_reorder',
      severity: 'info',
      title: 'Tools Checked Out',
      description: `${toolStats.checkedOut} tool(s) are checked out across teams.`,
      count: toolStats.checkedOut,
      link: ROUTES.TOOL_CHECKOUT,
    });
  }

  if (chemicalStats.available > 0 || toolStats.available > 0) {
    alerts.push({
      id: 'inventory-health',
      type: 'low_stock',
      severity: 'success',
      title: 'Inventory Healthy',
      description: `${toolStats.available} tools and ${chemicalStats.available} chemicals ready for deployment.`,
      count: toolStats.available + chemicalStats.available,
      link: ROUTES.DASHBOARD,
    });
  }

  return alerts;
};
