import { Tag } from 'antd';
import type { OrderPriority, RequestPriority, KitReorderPriority } from '../types';

interface PriorityBadgeProps {
  priority: OrderPriority | RequestPriority | KitReorderPriority;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'default',
  normal: 'blue',
  medium: 'orange',
  high: 'orange',
  critical: 'red',
  urgent: 'red',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  urgent: 'Urgent',
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const color = PRIORITY_COLORS[priority] || 'default';
  const label = PRIORITY_LABELS[priority] || priority;

  return <Tag color={color}>{label}</Tag>;
};
