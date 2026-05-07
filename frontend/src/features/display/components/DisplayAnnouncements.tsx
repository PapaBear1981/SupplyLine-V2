import { useEffect, useMemo, useState } from 'react';
import { useGetActiveAnnouncementsQuery } from '@features/admin/services/adminApi';
import styles from '../styles/Display.module.scss';

const PRIORITY_CLASS: Record<string, string> = {
  urgent: styles.priorityUrgent,
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
};

export const DisplayAnnouncements = () => {
  const { data } = useGetActiveAnnouncementsQuery(undefined, { pollingInterval: 60_000 });
  const announcements = useMemo(() => data ?? [], [data]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [announcements.length]);

  const index = announcements.length > 0 ? tick % announcements.length : 0;

  if (announcements.length === 0) {
    return (
      <section className={styles.announcementsPanel}>
        <div className={styles.announcementEmpty}>No active announcements</div>
      </section>
    );
  }

  const current = announcements[index];
  const priorityClass = PRIORITY_CLASS[current.priority] ?? styles.priorityMedium;

  return (
    <section className={`${styles.announcementsPanel} ${priorityClass}`}>
      <div className={styles.announcementMeta}>
        <span className={styles.announcementPriorityTag}>{current.priority}</span>
        <span className={styles.announcementCounter}>
          {index + 1} / {announcements.length}
        </span>
      </div>
      <div className={styles.announcementTitle}>{current.title}</div>
      <div className={styles.announcementMessage}>{current.message}</div>
    </section>
  );
};

export default DisplayAnnouncements;
