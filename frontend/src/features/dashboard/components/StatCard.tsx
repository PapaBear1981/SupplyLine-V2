import { Card } from 'antd';
import type { ReactNode } from 'react';
import styles from '../styles/Dashboard.module.scss';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: {
    value: number;
    label: string;
    type: 'positive' | 'negative' | 'neutral' | 'warning';
  };
  loading?: boolean;
  onClick?: () => void;
}

/**
 * Convert a human title like "Tools in Maintenance" into the stable
 * `dashboard-stat-tools-in-maintenance` testid slug used by E2E specs.
 */
const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const StatCard = ({
  title,
  value,
  icon,
  iconBg,
  iconColor,
  trend,
  loading = false,
  onClick,
}: StatCardProps) => {
  return (
    <Card
      className={styles.statCard}
      loading={loading}
      hoverable={!!onClick}
      onClick={onClick}
      styles={{ body: { padding: '20px' } }}
      data-testid={`dashboard-stat-${slugify(title)}`}
    >
      <div className={styles.statCardInner}>
        <div
          className={styles.statIcon}
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <div className={styles.statContent}>
          <div className={styles.statValue}>{value}</div>
          <div className={styles.statLabel}>{title}</div>
          {trend && (
            <span className={`${styles.statTrend} ${styles[trend.type]}`}>
              {trend.type === 'positive' && '+'}
              {trend.value} {trend.label}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
