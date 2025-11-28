import { Tag } from 'antd';
import type { OrderStatus, RequestStatus, ItemStatus, KitReorderStatus } from '../types';

interface StatusBadgeProps {
  status: OrderStatus | RequestStatus | ItemStatus | KitReorderStatus;
  type?: 'order' | 'request' | 'item' | 'kitReorder';
}

const STATUS_COLORS: Record<string, string> = {
  // Order statuses
  new: 'blue',
  awaiting_info: 'orange',
  in_progress: 'cyan',
  ordered: 'purple',
  shipped: 'geekblue',
  received: 'green',
  cancelled: 'red',

  // Request statuses
  partially_ordered: 'purple',
  partially_received: 'lime',

  // Item statuses
  pending: 'default',

  // Kit reorder statuses
  approved: 'cyan',
  fulfilled: 'green',
  urgent: 'red',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  awaiting_info: 'Awaiting Info',
  in_progress: 'In Progress',
  ordered: 'Ordered',
  shipped: 'Shipped',
  received: 'Received',
  cancelled: 'Cancelled',
  partially_ordered: 'Partially Ordered',
  partially_received: 'Partially Received',
  pending: 'Pending',
  approved: 'Approved',
  fulfilled: 'Fulfilled',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const color = STATUS_COLORS[status] || 'default';
  const label = STATUS_LABELS[status] || status;

  return <Tag color={color}>{label}</Tag>;
};
