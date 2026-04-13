import { List, Tag, SpinLoading } from 'antd-mobile';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetKitReordersQuery } from '../../services/kitsApi';
import type { KitReorderRequest } from '../../types';
import { MobileEmptyState } from '@shared/components/mobile';

dayjs.extend(relativeTime);

interface MobileKitReordersTabProps {
  kitId: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#faad14',
  approved: '#13c2c2',
  ordered: '#722ed1',
  fulfilled: '#52c41a',
  cancelled: '#ff4d4f',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#8c8c8c',
  medium: '#1890ff',
  high: '#faad14',
  urgent: '#ff4d4f',
};

/**
 * Mobile kit reorders tab — shows pending + recent reorder requests.
 * Read-only today; creating/approving/fulfilling reorders stays on
 * desktop until we revisit the action-heavy reorder workflow on
 * mobile.
 */
export const MobileKitReordersTab = ({ kitId }: MobileKitReordersTabProps) => {
  const { data: reorders, isLoading } = useGetKitReordersQuery({ kitId });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <SpinLoading />
      </div>
    );
  }

  if (!reorders || reorders.length === 0) {
    return (
      <MobileEmptyState
        title="No reorder requests"
        description="Reorder requests created for this kit will appear here."
      />
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <List>
        {reorders.map((reorder: KitReorderRequest) => (
          <List.Item
            key={reorder.id}
            title={reorder.description}
            description={
              <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}
              >
                <Tag color={STATUS_COLORS[reorder.status]} fill="outline">
                  {reorder.status}
                </Tag>
                <Tag color={PRIORITY_COLORS[reorder.priority]} fill="outline">
                  {reorder.priority}
                </Tag>
                <Tag fill="outline">
                  Qty {reorder.quantity_requested}
                </Tag>
                {reorder.part_number && (
                  <Tag fill="outline">PN: {reorder.part_number}</Tag>
                )}
              </div>
            }
          >
            <div style={{ fontSize: 13 }}>
              {reorder.requester_name ?? 'Requester'} •{' '}
              {dayjs(reorder.requested_date).fromNow()}
            </div>
          </List.Item>
        ))}
      </List>
    </div>
  );
};
