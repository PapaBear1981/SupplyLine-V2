import { useState } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Button,
  Space,
  Typography,
  message,
  Spin,
  Alert,
  Descriptions,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  ClockCircleOutlined,
  SaveOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useGetSecuritySettingsQuery, useUpdateSecuritySettingsMutation } from '../services/securityApi';

const { Title, Text, Paragraph } = Typography;

export const SystemSettings = () => {
  const { data: settings, isLoading, refetch } = useGetSecuritySettingsQuery();
  const [updateSettings, { isLoading: isUpdating }] = useUpdateSecuritySettingsMutation();
  const [form] = Form.useForm();
  const [hasChanges, setHasChanges] = useState(false);

  const handleSubmit = async (values: { session_timeout_minutes: number }) => {
    try {
      await updateSettings(values).unwrap();
      message.success('System settings updated successfully');
      setHasChanges(false);
      // Note: refetch() is not needed - RTK Query automatically refetches when SystemSettings tag is invalidated
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'data' in error) {
        const apiError = error as { data?: { error?: string } };
        message.error(apiError.data?.error || 'Failed to update settings');
      } else {
        message.error('Failed to update settings');
      }
    }
  };

  const handleReset = () => {
    form.resetFields();
    setHasChanges(false);
  };

  const handleValuesChange = () => {
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Alert
        message="Error"
        description="Failed to load system settings"
        type="error"
        showIcon
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          System Settings
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
          Configure system-wide security and operational settings
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* Session & Security Settings */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <ClockCircleOutlined style={{ marginRight: 8 }} />
                Session & Security
              </span>
            }
            bordered={false}
            style={{ height: '100%' }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onValuesChange={handleValuesChange}
              initialValues={{
                session_timeout_minutes: settings.session_timeout_minutes,
              }}
            >
              <Form.Item
                label="Session Inactivity Timeout"
                name="session_timeout_minutes"
                extra={`Idle sessions will be automatically logged out after this period. Valid range: ${settings.min_timeout_minutes}-${settings.max_timeout_minutes} minutes.`}
                rules={[
                  { required: true, message: 'Please enter a timeout value' },
                  {
                    type: 'number',
                    min: settings.min_timeout_minutes,
                    max: settings.max_timeout_minutes,
                    message: `Value must be between ${settings.min_timeout_minutes} and ${settings.max_timeout_minutes}`,
                  },
                ]}
              >
                <InputNumber
                  min={settings.min_timeout_minutes}
                  max={settings.max_timeout_minutes}
                  step={5}
                  addonAfter="minutes"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Divider />

              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Current Value">
                  {settings.session_timeout_minutes} minutes
                </Descriptions.Item>
                <Descriptions.Item label="Default Value">
                  {settings.default_timeout_minutes} minutes
                </Descriptions.Item>
                <Descriptions.Item label="Configuration Source">
                  <Text type={settings.source === 'database' ? 'success' : 'warning'}>
                    {settings.source === 'database' ? 'Database (Custom)' : 'Application Config (Default)'}
                  </Text>
                </Descriptions.Item>
                {settings.updated_by && (
                  <>
                    <Descriptions.Item label="Last Updated By">
                      {settings.updated_by.name} ({settings.updated_by.employee_number})
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Updated At">
                      {settings.updated_at
                        ? new Date(settings.updated_at).toLocaleString()
                        : 'Never'}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>

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

        {/* Additional System Information */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <InfoCircleOutlined style={{ marginRight: 8 }} />
                System Information
              </span>
            }
            bordered={false}
            style={{ height: '100%' }}
          >
            <Alert
              message="Session Timeout Behavior"
              description={
                <div>
                  <Paragraph style={{ marginBottom: 8 }}>
                    Users who are inactive for the configured timeout period will be automatically logged out
                    and redirected to the login page.
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 8 }}>
                    Activity includes:
                  </Paragraph>
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                    <li>Page navigation</li>
                    <li>API requests</li>
                    <li>Mouse or keyboard interactions</li>
                    <li>WebSocket events</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Alert
              message="Security Best Practices"
              description={
                <div>
                  <Paragraph style={{ marginBottom: 8 }}>
                    Recommended session timeout values:
                  </Paragraph>
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                    <li><strong>High Security:</strong> 15-30 minutes</li>
                    <li><strong>Standard:</strong> 30-60 minutes</li>
                    <li><strong>Low Security:</strong> 60-120 minutes</li>
                  </ul>
                </div>
              }
              type="warning"
              showIcon
            />
          </Card>
        </Col>
      </Row>

      {/* Future Settings Placeholder */}
      <Card
        title="Additional System Settings"
        bordered={false}
        style={{ marginTop: 24 }}
      >
        <Alert
          message="Coming Soon"
          description="Additional system settings such as password policies, login attempt limits, maintenance mode, and default UI preferences will be available in future updates."
          type="info"
          showIcon
        />
      </Card>
    </div>
  );
};
