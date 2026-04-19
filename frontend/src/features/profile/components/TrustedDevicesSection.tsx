import {
  Card,
  List,
  Space,
  Tag,
  Typography,
  Button,
  Popconfirm,
  Empty,
  Alert,
  Spin,
  message,
} from 'antd';
import {
  SafetyCertificateOutlined,
  DesktopOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  useListTrustedDevicesQuery,
  useRevokeTrustedDeviceMutation,
  useRevokeAllTrustedDevicesMutation,
} from '@features/auth/services/trustedDevicesApi';

const { Text, Paragraph } = Typography;

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export const TrustedDevicesSection = () => {
  const { data, isLoading, isError, refetch } = useListTrustedDevicesQuery();
  const [revokeDevice, { isLoading: isRevoking }] = useRevokeTrustedDeviceMutation();
  const [revokeAll, { isLoading: isRevokingAll }] = useRevokeAllTrustedDevicesMutation();

  const devices = data?.devices ?? [];

  const handleRevoke = async (id: number) => {
    try {
      await revokeDevice(id).unwrap();
      message.success('Device revoked');
    } catch {
      message.error('Failed to revoke device');
    }
  };

  const handleRevokeAll = async () => {
    try {
      const result = await revokeAll().unwrap();
      message.success(`Revoked ${result.count} device${result.count === 1 ? '' : 's'}`);
    } catch {
      message.error('Failed to revoke all devices');
    }
  };

  return (
    <Card
      title={
        <Space>
          <SafetyCertificateOutlined />
          Trusted Devices
        </Space>
      }
      extra={
        devices.length > 0 && (
          <Popconfirm
            title="Revoke all trusted devices?"
            description="You will be prompted for 2FA on every device on your next login."
            okText="Revoke all"
            okButtonProps={{ danger: true }}
            onConfirm={handleRevokeAll}
          >
            <Button danger size="small" loading={isRevokingAll}>
              Revoke all
            </Button>
          </Popconfirm>
        )
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Devices listed here can sign in without completing the 2FA challenge until they
          expire or you revoke them. They still require your password.
        </Paragraph>

        {isLoading && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        )}

        {isError && (
          <Alert
            type="error"
            showIcon
            message="Could not load trusted devices"
            description={
              <Button size="small" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        )}

        {!isLoading && !isError && devices.length === 0 && (
          <Empty
            description="No trusted devices. When you complete 2FA you can tick 'Trust this device' to skip future prompts here."
          />
        )}

        {!isLoading && !isError && devices.length > 0 && (
          <List
            itemLayout="horizontal"
            dataSource={devices}
            renderItem={(device) => (
              <List.Item
                actions={[
                  <Popconfirm
                    key="revoke"
                    title="Revoke this device?"
                    description="You'll be prompted for 2FA on it next login."
                    okText="Revoke"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleRevoke(device.id)}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      loading={isRevoking}
                    >
                      Revoke
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<DesktopOutlined style={{ fontSize: 24 }} />}
                  title={
                    <Space>
                      <Text strong>{device.device_label}</Text>
                      {device.is_current && <Tag color="green">This device</Tag>}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      {device.user_agent && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {device.user_agent.length > 120
                            ? `${device.user_agent.slice(0, 120)}…`
                            : device.user_agent}
                        </Text>
                      )}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        IP: {device.ip_address ?? '—'}
                        {' · '}Last used: {formatDate(device.last_used_at ?? device.created_at)}
                        {' · '}Expires: {formatDate(device.expires_at)}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Space>
    </Card>
  );
};
