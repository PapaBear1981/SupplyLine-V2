import { Card, Badge, Button, Tooltip } from 'antd';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  BellOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { DashboardAlert } from '../types';
import styles from '../styles/Dashboard.module.scss';

interface AlertsPanelProps {
  alerts: DashboardAlert[];
  loading?: boolean;
  onRefresh?: () => void;
}

export const AlertsPanel = ({ alerts, loading = false, onRefresh }: AlertsPanelProps) => {
  const navigate = useNavigate();

  const getAlertIcon = (severity: string, type: string) => {
    if (type === 'announcement') {
      return <BellOutlined style={{ color: '#1890ff' }} />;
    }

    switch (severity) {
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const handleAlertClick = (alert: DashboardAlert) => {
    if (alert.link) {
      navigate(alert.link);
    }
  };

  const sortedAlerts = [...alerts].sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <Card
      className={`${styles.sectionCard} ${styles.alertsPanel}`}
      title={
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <BellOutlined />
            Alerts & Notifications
            {alerts.length > 0 && (
              <Badge
                count={alerts.length}
                style={{ backgroundColor: alerts.some(a => a.severity === 'error') ? '#ff4d4f' : '#faad14' }}
              />
            )}
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
      {sortedAlerts.length === 0 ? (
        <div className={styles.noAlerts}>
          <CheckCircleOutlined className={styles.noAlertsIcon} style={{ color: '#52c41a' }} />
          <p>All systems operational. No alerts at this time.</p>
        </div>
      ) : (
        <div className={styles.alertsList}>
          {sortedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`${styles.alertItem} ${styles[alert.severity]}`}
              onClick={() => handleAlertClick(alert)}
            >
              <span className={styles.alertIcon}>
                {getAlertIcon(alert.severity, alert.type)}
              </span>
              <div className={styles.alertContent}>
                <div className={styles.alertTitle}>
                  {alert.title}
                </div>
                <div className={styles.alertDescription}>{alert.description}</div>
              </div>
              {alert.count !== undefined && alert.count > 0 && (
                <Badge
                  count={alert.count}
                  className={styles.alertBadge}
                  style={{
                    backgroundColor:
                      alert.severity === 'error'
                        ? '#ff4d4f'
                        : alert.severity === 'warning'
                        ? '#faad14'
                        : '#1890ff',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
