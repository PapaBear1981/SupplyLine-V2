import { useState, useMemo } from 'react';
import { Card, Tag, Empty, Button, Modal } from 'antd';
import { NotificationOutlined, ClockCircleOutlined, UserOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Announcement } from '@features/admin/types';
import styles from '../styles/Dashboard.module.scss';

dayjs.extend(relativeTime);

interface AnnouncementsPanelProps {
  announcements: Announcement[];
  loading?: boolean;
}

const PREVIEW_LIMIT = 4;

export const AnnouncementsPanel = ({ announcements, loading = false }: AnnouncementsPanelProps) => {
  const [modalOpen, setModalOpen] = useState(false);
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

  const activeAnnouncements = useMemo(() =>
    announcements
      .filter((a) => a.is_active)
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        const priorityA = priorityOrder[a.priority] ?? 4;
        const priorityB = priorityOrder[b.priority] ?? 4;
        return priorityA - priorityB;
      }),
    [announcements]
  );

  const previewAnnouncements = activeAnnouncements.slice(0, PREVIEW_LIMIT);
  const hasMore = activeAnnouncements.length > PREVIEW_LIMIT;

  const renderAnnouncement = (announcement: Announcement) => (
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
  );

  return (
    <>
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
          <>
            <div>
              {previewAnnouncements.map(renderAnnouncement)}
            </div>
            {hasMore && (
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => setModalOpen(true)}
                style={{ marginTop: 12, padding: 0 }}
              >
                See all {activeAnnouncements.length} announcements
              </Button>
            )}
          </>
        )}
      </Card>

      <Modal
        title={
          <span id="announcements-modal-title">
            <NotificationOutlined style={{ marginRight: 8 }} />
            All Announcements ({activeAnnouncements.length})
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        aria-labelledby="announcements-modal-title"
        footer={[
          <Button key="close" type="primary" onClick={() => setModalOpen(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {activeAnnouncements.map(renderAnnouncement)}
        </div>
      </Modal>
    </>
  );
};
