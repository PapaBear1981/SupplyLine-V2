import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  List,
  Tag,
  Space,
  Typography,
  Alert,
  Spin,
  message,
  Divider,
} from 'antd';
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useLazySearchToolsForCheckoutQuery,
  useCreateCheckoutMutation,
  useLazyCheckToolAvailabilityQuery,
} from '../services/checkoutApi';
import type { ToolSearchResult, ToolCondition } from '../types';

const { Text, Title } = Typography;

interface QuickCheckoutModalProps {
  open: boolean;
  onClose: () => void;
}

const conditionOptions: { value: ToolCondition; label: string }[] = [
  { value: 'New', label: 'New' },
  { value: 'Good', label: 'Good' },
  { value: 'Fair', label: 'Fair' },
  { value: 'Poor', label: 'Poor' },
];

export const QuickCheckoutModal = ({ open, onClose }: QuickCheckoutModalProps) => {
  const [form] = Form.useForm();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTool, setSelectedTool] = useState<ToolSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<ToolSearchResult[]>([]);

  const [searchTools, { isLoading: searching }] = useLazySearchToolsForCheckoutQuery();
  const [checkAvailability, { data: availability, isLoading: checkingAvailability }] =
    useLazyCheckToolAvailabilityQuery();
  const [createCheckout, { isLoading: submitting }] = useCreateCheckoutMutation();

  // Debounced search
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const timer = setTimeout(async () => {
        const result = await searchTools(searchTerm).unwrap();
        setSearchResults(result.tools || []);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // Clear results asynchronously to avoid cascading renders
      const timer = setTimeout(() => {
        setSearchResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, searchTools]);

  // Check availability when tool is selected
  useEffect(() => {
    if (selectedTool) {
      checkAvailability(selectedTool.id);
    }
  }, [selectedTool, checkAvailability]);

  const handleSelectTool = (tool: ToolSearchResult) => {
    setSelectedTool(tool);
    setSearchTerm('');
    setSearchResults([]);
    form.setFieldValue('condition_at_checkout', tool.condition);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!selectedTool) {
      message.error('Please select a tool');
      return;
    }

    if (!availability?.available) {
      message.error('This tool is not available for checkout');
      return;
    }

    try {
      await createCheckout({
        tool_id: selectedTool.id,
        expected_return_date: values.expected_return_date
          ? (values.expected_return_date as dayjs.Dayjs).toISOString()
          : undefined,
        notes: values.notes as string | undefined,
        condition_at_checkout: values.condition_at_checkout as ToolCondition | undefined,
        work_order: values.work_order as string | undefined,
        project: values.project as string | undefined,
      }).unwrap();

      message.success(`Tool ${selectedTool.tool_number} checked out successfully`);
      handleClose();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string; blocking_reasons?: string[] } };
      if (err.data?.blocking_reasons) {
        message.error(err.data.blocking_reasons.join(', '));
      } else {
        message.error(err.data?.error || 'Failed to checkout tool');
      }
    }
  };

  const handleClose = useCallback(() => {
    setSelectedTool(null);
    setSearchTerm('');
    setSearchResults([]);
    form.resetFields();
    onClose();
  }, [form, onClose]);

  const getStatusColor = (available: boolean, status: string) => {
    if (available) return 'success';
    if (status === 'checked_out') return 'warning';
    return 'error';
  };

  return (
    <Modal
      title={
        <Space>
          <ToolOutlined />
          Quick Checkout
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={700}
      footer={null}
      destroyOnClose
    >
      {/* Tool Search */}
      {!selectedTool && (
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>Search for a Tool</Title>
          <Input
            placeholder="Enter tool number, serial number, or description..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="large"
            autoFocus
          />

          {/* Search Results */}
          {searching && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin tip="Searching..." />
            </div>
          )}

          {searchResults.length > 0 && (
            <List
              style={{ marginTop: 16, maxHeight: 400, overflow: 'auto' }}
              dataSource={searchResults}
              renderItem={(tool) => (
                <List.Item
                  onClick={() => tool.available && handleSelectTool(tool)}
                  style={{
                    cursor: tool.available ? 'pointer' : 'not-allowed',
                    opacity: tool.available ? 1 : 0.6,
                    padding: '12px 16px',
                    borderRadius: 8,
                    marginBottom: 8,
                    border: '1px solid #d9d9d9',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (tool.available) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                      e.currentTarget.style.borderColor = '#1890ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#d9d9d9';
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      tool.available ? (
                        <CheckCircleOutlined
                          style={{ fontSize: 24, color: '#52c41a' }}
                        />
                      ) : (
                        <CloseCircleOutlined
                          style={{ fontSize: 24, color: '#ff4d4f' }}
                        />
                      )
                    }
                    title={
                      <Space>
                        <Text strong>{tool.tool_number}</Text>
                        <Text type="secondary">({tool.serial_number})</Text>
                        <Tag color={getStatusColor(tool.available, tool.status)}>
                          {tool.available ? 'Available' : tool.status.replace('_', ' ')}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Text>{tool.description}</Text>
                        {tool.checked_out_to && (
                          <Text type="secondary">
                            {' '}
                            - Checked out to {tool.checked_out_to}
                          </Text>
                        )}
                        <div>
                          <Tag>{tool.category}</Tag>
                          <Tag>{tool.condition}</Tag>
                          {tool.calibration_status !== 'not_applicable' && (
                            <Tag
                              color={
                                tool.calibration_status === 'current'
                                  ? 'green'
                                  : tool.calibration_status === 'due_soon'
                                  ? 'orange'
                                  : 'red'
                              }
                            >
                              Cal: {tool.calibration_status}
                            </Tag>
                          )}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}

          {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
            <Alert
              type="info"
              message="No tools found"
              description="Try a different search term"
              style={{ marginTop: 16 }}
            />
          )}
        </div>
      )}

      {/* Selected Tool & Checkout Form */}
      {selectedTool && (
        <div>
          {/* Selected Tool Info */}
          <div
            style={{
              background: '#f5f5f5',
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
              }}
            >
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {selectedTool.tool_number}
                </Title>
                <Text type="secondary">{selectedTool.serial_number}</Text>
                <div style={{ marginTop: 8 }}>
                  <Text>{selectedTool.description}</Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Tag>{selectedTool.category}</Tag>
                  <Tag>{selectedTool.condition}</Tag>
                </div>
              </div>
              <Button onClick={() => setSelectedTool(null)}>Change Tool</Button>
            </div>
          </div>

          {/* Availability Check */}
          {checkingAvailability && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Spin tip="Checking availability..." />
            </div>
          )}

          {availability && !availability.available && (
            <Alert
              type="error"
              message="Tool Not Available"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {availability.blocking_reasons.map((reason, index) => (
                    <li key={index}>{reason.message}</li>
                  ))}
                </ul>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {availability?.warnings && availability.warnings.length > 0 && (
            <Alert
              type="warning"
              message="Warnings"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {availability.warnings.map((warning, index) => (
                    <li key={index}>
                      <WarningOutlined style={{ marginRight: 8 }} />
                      {warning.message}
                    </li>
                  ))}
                </ul>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Checkout Form */}
          {availability?.available && (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                expected_return_date: dayjs().add(7, 'day'),
                condition_at_checkout: selectedTool.condition,
              }}
            >
              <Divider>Checkout Details</Divider>

              <Form.Item
                label="Expected Return Date"
                name="expected_return_date"
                rules={[{ required: true, message: 'Please select return date' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                  format="YYYY-MM-DD"
                />
              </Form.Item>

              <Form.Item label="Condition at Checkout" name="condition_at_checkout">
                <Select options={conditionOptions} />
              </Form.Item>

              <Form.Item label="Work Order" name="work_order">
                <Input placeholder="Work order number (optional)" />
              </Form.Item>

              <Form.Item label="Project" name="project">
                <Input placeholder="Project name (optional)" />
              </Form.Item>

              <Form.Item label="Notes" name="notes">
                <Input.TextArea
                  rows={3}
                  placeholder="Any notes about this checkout..."
                />
              </Form.Item>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button onClick={handleClose}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  Checkout Tool
                </Button>
              </div>
            </Form>
          )}
        </div>
      )}
    </Modal>
  );
};
