import { Card, List, Button, Toast, Tag } from 'antd-mobile';
import { BellOutlined } from '@ant-design/icons';
import { useNotifications } from '@shared/hooks/useNotifications';

/**
 * Settings card that lets mobile users enable local notifications.
 *
 * This covers the in-tab Notification API path (new messages,
 * overdue alerts, completed actions etc.). Full Web Push (server
 * driven, delivered when the app is closed) requires a service
 * worker — that will land with the PWA work and can layer on top
 * of this component by calling
 * `ServiceWorkerRegistration.pushManager.subscribe()` once the
 * user grants permission here.
 */
export const MobileNotificationsCard = () => {
  const { permission, isSupported, isGranted, isDenied, requestPermission, show } =
    useNotifications();

  if (!isSupported) {
    return (
      <Card title="Notifications" className="settings-card">
        <div style={{ padding: 8, fontSize: 13, color: 'var(--adm-color-weak)' }}>
          This browser does not support in-app notifications.
        </div>
      </Card>
    );
  }

  const handleEnable = async () => {
    const next = await requestPermission();
    if (next === 'granted') {
      Toast.show({ icon: 'success', content: 'Notifications enabled' });
      show({
        title: 'Notifications ready',
        body: 'SupplyLine will let you know about overdue checkouts, new announcements, and order updates.',
        tag: 'supplyline-notifications-welcome',
      });
    } else if (next === 'denied') {
      Toast.show({
        icon: 'fail',
        content: 'Permission denied. Re-enable from your browser settings.',
        duration: 3000,
      });
    }
  };

  const handleTest = () => {
    const notification = show({
      title: 'Test notification',
      body: 'If you can see this, notifications are working.',
      tag: 'supplyline-test',
    });
    if (!notification) {
      Toast.show({ icon: 'fail', content: 'Could not display notification' });
    }
  };

  return (
    <Card title="Notifications" className="settings-card">
      <List>
        <List.Item
          prefix={
            <BellOutlined
              style={{
                fontSize: 20,
                color: isGranted ? '#52c41a' : '#8c8c8c',
              }}
            />
          }
          description={
            isGranted
              ? 'Alerts enabled for overdue checkouts, announcements, and order updates.'
              : isDenied
                ? 'Notifications are blocked. Re-enable them from your browser settings.'
                : 'Get alerted about overdue checkouts, new announcements, and order updates.'
          }
          extra={
            <Tag
              color={isGranted ? 'success' : isDenied ? 'danger' : 'default'}
              fill="outline"
            >
              {permission === 'default' ? 'Off' : permission}
            </Tag>
          }
        >
          <div className="list-item-title">Push Alerts</div>
        </List.Item>
      </List>

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 4px' }}>
        {!isGranted && (
          <Button color="primary" onClick={handleEnable}>
            Enable notifications
          </Button>
        )}
        {isGranted && (
          <Button fill="outline" onClick={handleTest}>
            Send test
          </Button>
        )}
      </div>

      <div style={{ padding: '0 16px 16px', fontSize: 11, color: 'var(--adm-color-weak)' }}>
        These are local in-tab notifications. Server-driven push (even when the
        app is closed) arrives with the full mobile PWA.
      </div>
    </Card>
  );
};
