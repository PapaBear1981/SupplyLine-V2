import { useState, useMemo, useCallback } from 'react';
import { Card, Badge, Button, Tooltip, Modal } from 'antd';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  BellOutlined,
  ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { DashboardAlert } from '../types';
import styles from '../styles/Dashboard.module.scss';

interface AlertsPanelProps {
  alerts: DashboardAlert[];
  loading?: boolean;
  onRefresh?: () => void;
}

const PREVIEW_LIMIT = 4;

export const AlertsPanel = ({ alerts, loading = false, onRefresh }: AlertsPanelProps) => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

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

  const handleAlertClick = useCallback((alert: DashboardAlert) => {
    if (alert.link) {
      navigate(alert.link);
    }
  }, [navigate]);

  const sortedAlerts = useMemo(() =>
    [...alerts].sort((a, b) => {
      const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
      const severityA = severityOrder[a.severity] ?? 3;
      const severityB = severityOrder[b.severity] ?? 3;
      return severityA - severityB;
    }),
    [alerts]
  );

  const previewAlerts = sortedAlerts.slice(0, PREVIEW_LIMIT);
  const hasMore = sortedAlerts.length > PREVIEW_LIMIT;

  const renderAlert = (alert: DashboardAlert) => (
    <div
      key={alert.id}
      className={`${styles.alertItem} ${styles[alert.severity]}`}
      onClick={() => {
        handleAlertClick(alert);
        if (modalOpen) setModalOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAlertClick(alert);
          if (modalOpen) setModalOpen(false);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${alert.severity} alert: ${alert.title}. ${alert.description}`}
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
  );

  return (
    <>
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
          <div className={styles.noAlerts} aria-live="polite">
            <CheckCircleOutlined className={styles.noAlertsIcon} style={{ color: '#52c41a' }} />
            <p>All systems operational. No alerts at this time.</p>
          </div>
        ) : (
          <>
            <div className={styles.alertsList} aria-live="polite" aria-label="Alerts list">
              {previewAlerts.map(renderAlert)}
            </div>
            {hasMore && (
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => setModalOpen(true)}
                style={{ marginTop: 12, padding: 0 }}
              >
                See all {sortedAlerts.length} alerts
              </Button>
            )}
          </>
        )}
      </Card>

      <Modal
        title={
          <span id="alerts-modal-title">
            <BellOutlined style={{ marginRight: 8 }} />
            All Alerts & Notifications ({sortedAlerts.length})
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        aria-labelledby="alerts-modal-title"
        footer={[
          <Button key="close" type="primary" onClick={() => setModalOpen(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div className={styles.alertsList}>
            {sortedAlerts.map(renderAlert)}
          </div>
        </div>
      </Modal>
    </>
  );
};
