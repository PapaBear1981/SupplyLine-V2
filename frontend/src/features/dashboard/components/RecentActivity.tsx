import { Card, Timeline, Tag, Empty, Button, Tooltip } from 'antd';
import {
  HistoryOutlined,
  SwapOutlined,
  ExportOutlined,
  ShoppingCartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { KitActivity } from '@features/kits/types';
import styles from '../styles/Dashboard.module.scss';

dayjs.extend(relativeTime);

interface RecentActivityProps {
  activities: KitActivity[];
  loading?: boolean;
  onRefresh?: () => void;
}

export const RecentActivity = ({ activities, loading = false, onRefresh }: RecentActivityProps) => {
  const navigate = useNavigate();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'issuance':
        return <ExportOutlined style={{ color: '#1890ff' }} />;
      case 'transfer':
        return <SwapOutlined style={{ color: '#722ed1' }} />;
      case 'reorder':
        return <ShoppingCartOutlined style={{ color: '#fa8c16' }} />;
      default:
        return <HistoryOutlined />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'issuance':
        return 'blue';
      case 'transfer':
        return 'purple';
      case 'reorder':
        return 'orange';
      default:
        return 'default';
    }
  };

  const handleActivityClick = (activity: KitActivity) => {
    navigate(`/kits/${activity.kit_id}`);
  };

  return (
    <Card
      className={`${styles.sectionCard} ${styles.activityFeed}`}
      title={
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <HistoryOutlined />
            Recent Activity
          </span>
          {onRefresh && (
            <Tooltip title="Refresh">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined spin={loading} />}
                onClick={onRefresh}
              />
            </Tooltip>
          )}
        </div>
      }
      loading={loading}
    >
      {activities.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No recent activity"
        />
      ) : (
        <div className={styles.activityList}>
          <Timeline
            items={activities.map((activity) => ({
              dot: getActivityIcon(activity.type),
              children: (
                <div
                  className={styles.activityItem}
                  onClick={() => handleActivityClick(activity)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag color={getActivityColor(activity.type)} style={{ margin: 0 }}>
                      {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                    </Tag>
                    <span style={{ fontWeight: 500 }}>{activity.kit_name}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {activity.description}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary, #8c8c8c)' }}>
                    {activity.user_name} &bull; {dayjs(activity.created_at).fromNow()}
                  </div>
                </div>
              ),
            }))}
          />
        </div>
      )}
    </Card>
  );
};
