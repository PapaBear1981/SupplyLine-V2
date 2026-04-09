import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
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
  Tooltip,
} from 'antd';
import {
  RobotOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useGetAISettingsQuery, useUpdateAISettingsMutation } from '../services/aiApi';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const PROVIDER_LABELS: Record<string, string> = {
  claude:      'Claude (Anthropic)',
  openai:      'OpenAI',
  openrouter:  'OpenRouter',
  ollama:      'Ollama (Local)',
};

const DEFAULT_MODELS: Record<string, string[]> = {
  claude:     ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  openai:     ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-6', 'google/gemma-3-4b-it', 'meta-llama/llama-3.3-70b-instruct'],
  ollama:     ['gemma3:4b', 'gemma3:12b', 'llama3.2', 'mistral', 'phi4-mini'],
};

const NEEDS_BASE_URL = new Set(['openrouter', 'ollama']);

const DEFAULT_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai',
  ollama:     'http://localhost:11434',
};

const PROVIDER_DOCS: Record<string, string> = {
  claude:     'Get your API key from console.anthropic.com',
  openai:     'Get your API key from platform.openai.com',
  openrouter: 'Get your API key from openrouter.ai — gives access to hundreds of models through one key',
  ollama:     'No API key needed. Ollama runs locally. Ensure Ollama is running and accessible at the Base URL.',
};

export const AISettings = () => {
  const { data: settings, isLoading } = useGetAISettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateAISettingsMutation();
  const [form] = Form.useForm();
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('claude');

  // Sync form when settings load
  useEffect(() => {
    if (settings) {
      const provider = settings.provider || 'claude';
      setSelectedProvider(provider);
      form.setFieldsValue({
        enabled:  settings.enabled,
        provider,
        model:    settings.model || DEFAULT_MODELS[provider]?.[0] || '',
        base_url: settings.base_url || DEFAULT_BASE_URLS[provider] || '',
        api_key:  '',   // Never pre-fill the key
      });
    }
  }, [settings, form]);

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    // Auto-fill default model and base URL when switching providers
    form.setFieldsValue({
      model:    DEFAULT_MODELS[provider]?.[0] || '',
      base_url: DEFAULT_BASE_URLS[provider] || '',
    });
    setHasChanges(true);
  };

  const handleSubmit = async (values: {
    enabled: boolean;
    provider: string;
    api_key: string;
    model: string;
    base_url: string;
  }) => {
    try {
      const payload: Record<string, unknown> = {
        enabled:  values.enabled,
        provider: values.provider,
        model:    values.model,
        base_url: values.base_url,
      };
      // Only send api_key if the user typed something
      if (values.api_key?.trim()) {
        payload.api_key = values.api_key.trim();
      }

      await updateSettings(payload).unwrap();
      message.success('AI settings saved successfully');
      form.setFieldValue('api_key', '');
      setHasChanges(false);
    } catch (err: unknown) {
      const error = err as { data?: { error?: string } };
      message.error(error?.data?.error || 'Failed to save AI settings');
    }
  };

  const handleReset = () => {
    if (settings) {
      form.setFieldsValue({
        enabled:  settings.enabled,
        provider: settings.provider,
        model:    settings.model,
        base_url: settings.base_url,
        api_key:  '',
      });
      setSelectedProvider(settings.provider);
    }
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!settings) {
    return <Alert message="Failed to load AI settings" type="error" showIcon />;
  }

  const suggestedModels = DEFAULT_MODELS[selectedProvider] || [];
  const showBaseUrl = NEEDS_BASE_URL.has(selectedProvider);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <RobotOutlined style={{ marginRight: 8 }} />
          AI Assistant
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
          Configure the AI assistant provider, model, and API credentials. The assistant is
          accessible from every page via the chat button in the bottom-right corner.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* Configuration form */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ApiOutlined />
                Provider Configuration
              </Space>
            }
            bordered={false}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onValuesChange={() => setHasChanges(true)}
              initialValues={{ enabled: false, provider: 'claude' }}
            >
              {/* Enable toggle */}
              <Form.Item name="enabled" label="Enable AI Assistant" valuePropName="checked">
                <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
              </Form.Item>

              <Divider />

              {/* Provider */}
              <Form.Item
                name="provider"
                label="AI Provider"
                rules={[{ required: true, message: 'Select a provider' }]}
              >
                <Select onChange={handleProviderChange}>
                  {Object.entries(PROVIDER_LABELS).map(([val, label]) => (
                    <Option key={val} value={val}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Model */}
              <Form.Item
                name="model"
                label="Model"
                extra="Enter any model name, or pick one from the suggestions below."
                rules={[{ required: true, message: 'Enter a model name' }]}
              >
                <Input placeholder={DEFAULT_MODELS[selectedProvider]?.[0] || 'model-name'} />
              </Form.Item>
              {suggestedModels.length > 0 && (
                <div style={{ marginTop: -16, marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Suggestions: </Text>
                  {suggestedModels.map((m) => (
                    <Tag
                      key={m}
                      style={{ cursor: 'pointer', marginBottom: 4 }}
                      onClick={() => { form.setFieldValue('model', m); setHasChanges(true); }}
                    >
                      {m}
                    </Tag>
                  ))}
                </div>
              )}

              {/* Base URL (only for providers that need it) */}
              {showBaseUrl && (
                <Form.Item
                  name="base_url"
                  label={
                    <Space>
                      Base URL
                      <Tooltip title={
                        selectedProvider === 'ollama'
                          ? 'The URL where Ollama is running. Default: http://localhost:11434'
                          : 'OpenRouter base URL. Default: https://openrouter.ai'
                      }>
                        <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: 'Enter the base URL' }]}
                >
                  <Input placeholder={DEFAULT_BASE_URLS[selectedProvider] || 'https://...'} />
                </Form.Item>
              )}

              {/* API Key */}
              <Form.Item
                name="api_key"
                label={
                  <Space>
                    <KeyOutlined />
                    API Key
                    {settings.api_key_configured ? (
                      <Tag icon={<CheckCircleOutlined />} color="success">Configured</Tag>
                    ) : (
                      <Tag icon={<CloseCircleOutlined />} color="error">Not set</Tag>
                    )}
                  </Space>
                }
                extra={
                  selectedProvider === 'ollama'
                    ? 'Ollama does not require an API key.'
                    : settings.api_key_configured
                    ? 'Leave blank to keep the existing key, or enter a new one to replace it.'
                    : 'Enter your API key. It will be stored securely on the server.'
                }
              >
                <Input.Password
                  placeholder={
                    selectedProvider === 'ollama'
                      ? 'Not required for Ollama'
                      : settings.api_key_configured
                      ? '••••••••  (key already set — leave blank to keep)'
                      : 'Paste your API key here'
                  }
                  disabled={selectedProvider === 'ollama'}
                />
              </Form.Item>

              <Divider />

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={isSaving}
                    disabled={!hasChanges}
                  >
                    Save Settings
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={!hasChanges}>
                    Reset
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Info panel */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <InfoCircleOutlined />
                Provider Information
              </Space>
            }
            bordered={false}
          >
            <Alert
              message={PROVIDER_LABELS[selectedProvider] || selectedProvider}
              description={PROVIDER_DOCS[selectedProvider]}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Alert
              message="Security"
              description="API keys are stored server-side and are never sent to the browser. The assistant runs all requests through the SupplyLine backend."
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Alert
              message="What the assistant can do"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Answer questions about tool and chemical inventory</li>
                  <li>Describe calibration and checkout status</li>
                  <li>Explain system features and navigation</li>
                  <li>Help draft procurement request details</li>
                  <li>Provide MRO best-practice guidance</li>
                </ul>
              }
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
