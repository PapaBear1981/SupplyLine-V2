import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Switch,
  Button,
  Space,
  Typography,
  message,
  Spin,
  Alert,
  Divider,
  Row,
  Col,
  Tag,
} from 'antd';
import {
  GithubOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useGetGitHubSettingsQuery, useUpdateGitHubSettingsMutation } from '../services/adminApi';

const { Title, Text, Paragraph } = Typography;

export const GitHubSettings = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading, refetch } = useGetGitHubSettingsQuery();
  const [updateSettings] = useUpdateGitHubSettingsMutation();

  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        enabled: settings.enabled,
        owner:   settings.owner,
        repo:    settings.repo,
        token:   '',
      });
    }
  }, [settings, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload: Record<string, unknown> = {
        enabled: values.enabled,
        owner:   values.owner,
        repo:    values.repo,
      };
      if (values.token) {
        payload.token = values.token;
      }

      await updateSettings(payload).unwrap();
      message.success('GitHub settings saved');
      form.setFieldValue('token', '');
      refetch();
    } catch {
      message.error('Failed to save GitHub settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <Card>
        <Space direction="vertical" size="small" style={{ marginBottom: 24 }}>
          <Space align="center">
            <GithubOutlined style={{ fontSize: 24 }} />
            <Title level={4} style={{ margin: 0 }}>GitHub Integration</Title>
          </Space>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Automatically create a GitHub issue whenever a user submits a bug report.
            Requires a GitHub Personal Access Token with <Text code>repo</Text> scope.
          </Paragraph>
        </Space>

        {settings && (
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text>Status:</Text>
              {settings.enabled ? (
                <Tag icon={<CheckCircleOutlined />} color="success">Enabled</Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="default">Disabled</Tag>
              )}
              {settings.token_set ? (
                <Tag icon={<KeyOutlined />} color="blue">Token configured</Tag>
              ) : (
                <Tag color="warning">No token</Tag>
              )}
            </Space>
          </div>
        )}

        <Divider />

        <Form form={form} layout="vertical">
          <Form.Item name="enabled" label="Auto-create GitHub Issues" valuePropName="checked">
            <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="owner"
                label="GitHub Owner (user or org)"
                rules={[{ required: true, message: 'Owner is required' }]}
              >
                <Input placeholder="e.g. papabear1981" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="repo"
                label="Repository Name"
                rules={[{ required: true, message: 'Repo is required' }]}
              >
                <Input placeholder="e.g. supplyline-v2" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="token"
            label={
              <Space>
                GitHub Personal Access Token
                {settings?.token_set && (
                  <Text type="secondary" style={{ fontWeight: 'normal' }}>
                    (leave blank to keep existing token)
                  </Text>
                )}
              </Space>
            }
          >
            <Input.Password
              placeholder={settings?.token_set ? '••••••••••••••••' : 'ghp_...'}
              autoComplete="new-password"
            />
          </Form.Item>

          {!settings?.token_set && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="A token is required for issue creation to work."
              description={
                <>
                  Generate a Personal Access Token at{' '}
                  <strong>GitHub → Settings → Developer settings → Personal access tokens</strong>.
                  Grant the <Text code>repo</Text> scope (or <Text code>public_repo</Text> for public repos).
                </>
              }
            />
          )}

          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              Save Settings
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Refresh
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};
