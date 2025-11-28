import { Card, Tag, Empty } from 'antd';
import { NotificationOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Announcement } from '@features/admin/types';
import styles from '../styles/Dashboard.module.scss';

dayjs.extend(relativeTime);

interface AnnouncementsPanelProps {
  announcements: Announcement[];
  loading?: boolean;
}

export const AnnouncementsPanel = ({ announcements, loading = false }: AnnouncementsPanelProps) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'blue';
      default:
        return 'green';
    }
  };

  const activeAnnouncements = announcements
    .filter((a) => a.is_active)
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 5);

  return (
    <Card
      className={styles.sectionCard}
      title={
        <span className={styles.sectionTitle}>
          <NotificationOutlined />
          Announcements
          {activeAnnouncements.length > 0 && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {activeAnnouncements.length} Active
            </Tag>
          )}
        </span>
      }
      loading={loading}
    >
      {activeAnnouncements.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No announcements"
        />
      ) : (
        <div>
          {activeAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className={`${styles.announcementItem} ${styles[announcement.priority]}`}
            >
              <div className={styles.announcementTitle}>
                <Tag color={getPriorityColor(announcement.priority)} style={{ margin: 0 }}>
                  {announcement.priority.toUpperCase()}
                </Tag>
                <span>{announcement.title}</span>
              </div>
              <div className={styles.announcementMessage}>
                {announcement.message}
              </div>
              <div className={styles.announcementMeta}>
                <span>
                  <UserOutlined style={{ marginRight: 4 }} />
                  {announcement.created_by_user?.name || 'System'}
                </span>
                <span>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {dayjs(announcement.created_at).fromNow()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
