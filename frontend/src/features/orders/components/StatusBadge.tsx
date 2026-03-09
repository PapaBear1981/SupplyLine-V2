import { Tag } from 'antd';
import type { OrderStatus, RequestStatus, ItemStatus, KitReorderStatus } from '../types';

interface StatusBadgeProps {
  status: OrderStatus | RequestStatus | ItemStatus | KitReorderStatus | string;
  type?: 'order' | 'request' | 'item' | 'kitReorder';
}

const STATUS_COLORS: Record<string, string> = {
  // Phase 2 request statuses (operational language for mechanics)
  new: 'blue',
  under_review: 'cyan',
  pending_fulfillment: 'gold',
  in_transfer: 'geekblue',
  awaiting_external_procurement: 'orange',
  partially_fulfilled: 'lime',
  fulfilled: 'green',
  needs_info: 'volcano',
  cancelled: 'red',

  // Phase 2 fulfillment statuses (fulfillment staff workspace)
  assigned: 'cyan',
  sourcing: 'gold',
  closed: 'default',

  // Legacy statuses (backward compat with existing data)
  awaiting_info: 'orange',
  in_progress: 'cyan',
  ordered: 'purple',
  shipped: 'geekblue',
  received: 'green',
  partially_ordered: 'purple',
  partially_received: 'lime',

  // Item statuses
  pending: 'default',

  // Kit reorder statuses
  approved: 'cyan',
};

const STATUS_LABELS: Record<string, string> = {
  // Phase 2 request statuses
  new: 'New',
  under_review: 'Under Review',
  pending_fulfillment: 'Pending Fulfillment',
  in_transfer: 'In Transfer',
  awaiting_external_procurement: 'Awaiting Procurement',
  partially_fulfilled: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  needs_info: 'Needs Info',
  cancelled: 'Cancelled',

  // Phase 2 fulfillment statuses
  assigned: 'Assigned',
  sourcing: 'Sourcing',
  closed: 'Closed',

  // Legacy statuses
  awaiting_info: 'Awaiting Info',
  in_progress: 'In Progress',
  ordered: 'Ordered',
  shipped: 'Shipped',
  received: 'Received',
  partially_ordered: 'Partially Ordered',
  partially_received: 'Partially Received',

  // Item statuses
  pending: 'Pending',

  // Kit reorder statuses
  approved: 'Approved',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const color = STATUS_COLORS[status] || 'default';
  const label = STATUS_LABELS[status] || status;

  return <Tag color={color}>{label}</Tag>;
};
