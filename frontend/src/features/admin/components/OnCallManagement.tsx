import { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Space,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Avatar,
  Descriptions,
  Divider,
  Alert,
  theme,
} from 'antd';
import {
  PhoneOutlined,
  ToolOutlined,
  InboxOutlined,
  SaveOutlined,
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetAdminOnCallPersonnelQuery,
  useUpdateOnCallPersonnelMutation,
  type OnCallEntry,
} from '../services/oncallApi';
import { useGetUsersQuery } from '@features/users/services/usersApi';

const { Title, Paragraph, Text } = Typography;

interface OnCallFormValues {
  materials_user_id: number | null;
  maintenance_user_id: number | null;
}

export const OnCallManagement = () => {
  const { token } = theme.useToken();
  const { data: oncall, isLoading } = useGetAdminOnCallPersonnelQuery();
  const { data: users = [], isLoading: usersLoading } = useGetUsersQuery();
  const [updateOnCall, { isLoading: isUpdating }] = useUpdateOnCallPersonnelMutation();
  const [form] = Form.useForm<OnCallFormValues>();
  const [hasChanges, setHasChanges] = useState(false);

  const handleSubmit = async (values: OnCallFormValues) => {
    try {
      await updateOnCall({
        materials_user_id: values.materials_user_id ?? null,
        maintenance_user_id: values.maintenance_user_id ?? null,
      }).unwrap();
      message.success('On-call personnel updated successfully');
      setHasChanges(false);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'data' in error) {
        const apiError = error as { data?: { error?: string } };
        message.error(apiError.data?.error || 'Failed to update on-call personnel');
      } else {
        message.error('Failed to update on-call personnel');
      }
    }
  };

  const handleReset = () => {
    if (oncall) {
      form.setFieldsValue({
        materials_user_id: oncall.materials.user?.id ?? null,
        maintenance_user_id: oncall.maintenance.user?.id ?? null,
      });
    }
    setHasChanges(false);
  };

  const activeUsers = users.filter((u) => u.is_active);

  const userOptions = activeUsers.map((u) => ({
    value: u.id,
    label: `${u.name} (#${u.employee_number})${u.department ? ` · ${u.department}` : ''}`,
    searchText: `${u.name} ${u.employee_number} ${u.department ?? ''}`.toLowerCase(),
  }));

  const renderCurrentCard = (
    title: string,
    icon: React.ReactNode,
    accentColor: string,
    entry: OnCallEntry | undefined
  ) => {
    const user = entry?.user ?? null;
    return (
      <Card
        size="small"
        bordered
        style={{ background: token.colorFillAlter }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: `${accentColor}1a`,
              color: accentColor,
            }}
          >
            {icon}
          </span>
          <Text strong>{title}</Text>
        </div>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              size={40}
              src={user.avatar || undefined}
              icon={!user.avatar && <UserOutlined />}
              style={{ backgroundColor: user.avatar ? undefined : accentColor }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>{user.name}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                #{user.employee_number}
                {user.department ? ` · ${user.department}` : ''}
              </Text>
            </div>
          </div>
        ) : (
          <Text type="secondary">No one currently assigned</Text>
        )}
        {entry?.updated_at && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Updated {dayjs(entry.updated_at).format('MMM D, YYYY h:mm A')}
              {entry.updated_by ? ` by ${entry.updated_by.name}` : ''}
            </Text>
          </div>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <PhoneOutlined style={{ marginRight: 8 }} />
          On-Call Personnel
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
          Set which users are currently on call for Materials and Maintenance. These assignments are
          displayed on the main dashboard for everyone.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <span>
                <PhoneOutlined style={{ marginRight: 8 }} />
                Update Assignments
              </span>
            }
            bordered={false}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onValuesChange={() => setHasChanges(true)}
              initialValues={{
                materials_user_id: oncall?.materials.user?.id ?? null,
                maintenance_user_id: oncall?.maintenance.user?.id ?? null,
              }}
            >
              <Form.Item
                label={
                  <span>
                    <InboxOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                    Materials On-Call
                  </span>
                }
                name="materials_user_id"
                extra="User responsible for materials, tools, and chemical inventory after hours"
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Select a user or clear assignment"
                  loading={usersLoading}
                  options={userOptions}
                  filterOption={(input, option) =>
                    (option?.searchText as string | undefined)?.includes(input.toLowerCase()) ?? false
                  }
                />
              </Form.Item>

              <Form.Item
                label={
                  <span>
                    <ToolOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
                    Maintenance On-Call
                  </span>
                }
                name="maintenance_user_id"
                extra="User responsible for equipment maintenance and repairs after hours"
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Select a user or clear assignment"
                  loading={usersLoading}
                  options={userOptions}
                  filterOption={(input, option) =>
                    (option?.searchText as string | undefined)?.includes(input.toLowerCase()) ?? false
                  }
                />
              </Form.Item>

              <Divider />

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={isUpdating}
                    disabled={!hasChanges}
                  >
                    Save Changes
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleReset}
                    disabled={!hasChanges}
                  >
                    Reset
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Currently On Call" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {renderCurrentCard(
                'Materials',
                <InboxOutlined />,
                '#1890ff',
                oncall?.materials
              )}
              {renderCurrentCard(
                'Maintenance',
                <ToolOutlined />,
                '#fa8c16',
                oncall?.maintenance
              )}
            </Space>

            <Divider />

            <Alert
              type="info"
              showIcon
              message="Visibility"
              description={
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Shown on">Main Dashboard (top of page)</Descriptions.Item>
                  <Descriptions.Item label="Visible to">All authenticated users</Descriptions.Item>
                  <Descriptions.Item label="Managed by">Administrators</Descriptions.Item>
                </Descriptions>
              }
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
