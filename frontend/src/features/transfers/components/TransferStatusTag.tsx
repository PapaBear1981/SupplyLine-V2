import { Tag } from 'antd';
import type { TransferStatus } from '../types';

const STATUS_META: Record<TransferStatus, { label: string; color: string }> = {
  pending_receipt: { label: 'Pending receipt', color: 'gold' },
  received: { label: 'Received', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
  completed: { label: 'Completed', color: 'blue' },
};

export const TransferStatusTag = ({ status }: { status: TransferStatus }) => {
  const meta = STATUS_META[status] || { label: status, color: 'default' };
  return <Tag color={meta.color}>{meta.label}</Tag>;
};
