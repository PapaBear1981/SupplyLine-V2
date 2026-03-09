import { Tag } from 'antd';
import type { OrderPriority, RequestPriority, KitReorderPriority } from '../types';

interface PriorityBadgeProps {
  priority: OrderPriority | RequestPriority | KitReorderPriority | string;
}

const PRIORITY_COLORS: Record<string, string> = {
  // Phase 2 operational priorities
  routine: 'blue',
  urgent: 'orange',
  aog: 'red',

  // Legacy priorities (backward compat)
  low: 'default',
  normal: 'blue',
  medium: 'orange',
  high: 'orange',
  critical: 'red',
};

const PRIORITY_LABELS: Record<string, string> = {
  // Phase 2 operational priorities
  routine: 'Routine',
  urgent: 'Urgent',
  aog: 'AOG',

  // Legacy priorities
  low: 'Low',
  normal: 'Normal',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const color = PRIORITY_COLORS[priority] || 'default';
  const label = PRIORITY_LABELS[priority] || priority;

  return <Tag color={color}>{label}</Tag>;
};
