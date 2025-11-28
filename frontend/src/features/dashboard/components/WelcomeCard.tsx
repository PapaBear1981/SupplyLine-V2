import { Avatar, Typography } from 'antd';
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { User } from '@features/users/types';
import styles from '../styles/Dashboard.module.scss';

const { Text } = Typography;

interface WelcomeCardProps {
  user: User | null;
  activeUsersCount: number;
  primaryColor?: string;
}

export const WelcomeCard = ({ user, activeUsersCount, primaryColor = '#1890ff' }: WelcomeCardProps) => {
  const getGreeting = () => {
    const hour = dayjs().hour();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const gradientStyle = {
    '--primary-gradient-start': primaryColor,
    '--primary-gradient-end': adjustColorBrightness(primaryColor, -20),
  } as React.CSSProperties;

  return (
    <div className={styles.welcomeCard} style={gradientStyle}>
      <div className={styles.welcomeContent}>
        <Avatar
          size={72}
          src={user?.avatar}
          icon={!user?.avatar && <UserOutlined />}
          className={styles.welcomeAvatar}
        />
        <div className={styles.welcomeText}>
          <h1>{getGreeting()}, {user?.name?.split(' ')[0] || 'User'}</h1>
          <p>Welcome back to SupplyLine. Here's what's happening today.</p>
        </div>
        <div className={styles.welcomeMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaValue}>{activeUsersCount}</span>
            <span className={styles.metaLabel}>Users Online</span>
          </div>
          <div className={styles.metaItem}>
            <ClockCircleOutlined style={{ fontSize: 16, marginBottom: 4 }} />
            <Text style={{ color: 'white', fontSize: 13 }}>
              {dayjs().format('ddd, MMM D')}
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to adjust color brightness
function adjustColorBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}
