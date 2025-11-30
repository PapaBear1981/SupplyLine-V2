import { ReactNode } from 'react';
import { Typography, Space } from 'antd';
import styles from './MobilePage.module.scss';

const { Title, Text } = Typography;

interface MobileAction {
  key: string;
  node: ReactNode;
}

interface MobilePageProps {
  title: string;
  subtitle?: string;
  actions?: MobileAction[];
  children: ReactNode;
}

export const MobilePage = ({ title, subtitle, actions, children }: MobilePageProps) => (
  <div className={styles.mobilePage}>
    <div className={styles.header}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <Title level={4} style={{ margin: 0 }}>
            {title}
          </Title>
          {subtitle && (
            <Text className={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </div>
        {actions && actions.length > 0 && (
          <Space className={styles.actions} size={8} wrap>
            {actions.map((action) => (
              <span key={action.key}>{action.node}</span>
            ))}
          </Space>
        )}
      </div>
    </div>

    <div className={styles.stack}>
      <div className={styles.surface}>
        {children}
      </div>
    </div>
  </div>
);
