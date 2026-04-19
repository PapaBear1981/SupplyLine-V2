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
  Steps,
  theme,
  Badge,
  Result,
  Table,
} from 'antd';
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ToolOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useLazySearchToolsForCheckoutQuery,
  useBatchCheckoutMutation,
} from '../services/checkoutApi';
import type { BatchCheckoutResult, ToolCondition, ToolSearchResult } from '../types';
import { UserSearchSelect } from './UserSearchSelect';
import type { User } from '@features/users/types';

const { Text, Title } = Typography;
const { useToken } = theme;

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

type Step = 'tools' | 'user' | 'details' | 'results';

export const QuickCheckoutModal = ({ open, onClose }: QuickCheckoutModalProps) => {
  const { token } = useToken();
  const [form] = Form.useForm();
  const [step, setStep] = useState<Step>('tools');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTools, setSelectedTools] = useState<ToolSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchResults, setSearchResults] = useState<ToolSearchResult[]>([]);
  const [batchResults, setBatchResults] = useState<BatchCheckoutResult[]>([]);

  const [searchTools, { isLoading: searching }] = useLazySearchToolsForCheckoutQuery();
  const [batchCheckout, { isLoading: submitting }] = useBatchCheckoutMutation();

  // Debounced tool search
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const timer = setTimeout(async () => {
        const result = await searchTools(searchTerm).unwrap();
        setSearchResults(result.tools || []);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setSearchResults([]), 0);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, searchTools]);

  const isToolSelected = (tool: ToolSearchResult) =>
    selectedTools.some((t) => t.id === tool.id);

  const handleAddTool = (tool: ToolSearchResult) => {
    if (!isToolSelected(tool)) {
      setSelectedTools((prev) => [...prev, tool]);
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleRemoveTool = (toolId: number) => {
    setSelectedTools((prev) => prev.filter((t) => t.id !== toolId));
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (selectedTools.length === 0 || !selectedUser) return;

    try {
      const result = await batchCheckout({
        tool_ids: selectedTools.map((t) => t.id),
        user_id: selectedUser.id,
        expected_return_date: values.expected_return_date
          ? (values.expected_return_date as dayjs.Dayjs).toISOString()
          : undefined,
        notes: values.notes as string | undefined,
        condition_at_checkout: values.condition_at_checkout as ToolCondition | undefined,
        work_order: values.work_order as string | undefined,
        project: values.project as string | undefined,
      }).unwrap();

      setBatchResults(result.results);
      setStep('results');

      if (result.failed === 0) {
        message.success(
          `${result.succeeded} tool${result.succeeded !== 1 ? 's' : ''} checked out to ${selectedUser.name} successfully`
        );
      } else if (result.succeeded > 0) {
        message.warning(
          `${result.succeeded} succeeded, ${result.failed} failed`
        );
      } else {
        message.error('All checkouts failed');
      }
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to checkout tools');
    }
  };

  const handleClose = useCallback(() => {
    setStep('tools');
    setSelectedTools([]);
    setSelectedUser(null);
    setSearchTerm('');
    setSearchResults([]);
    setBatchResults([]);
    form.resetFields();
    onClose();
  }, [form, onClose]);

  const getStatusColor = (available: boolean, status: string) => {
    if (available) return 'success';
    if (status === 'checked_out') return 'warning';
    return 'error';
  };

  const stepIndex = { tools: 0, user: 1, details: 2, results: 3 };

  // ── Step: Tool Selection ─────────────────────────────────────────────────
  const renderToolStep = () => (
    <div>
      <Title level={5}>Search and Add Tools</Title>
      <Input
        placeholder="Enter tool number, serial number, or description..."
        prefix={<SearchOutlined />}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        size="large"
        autoFocus
      />

      {searching && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="Searching..." />
        </div>
      )}

      {searchResults.length > 0 && (
        <List
          style={{ marginTop: 16, maxHeight: 300, overflow: 'auto' }}
          dataSource={searchResults}
          renderItem={(tool) => {
            const alreadyAdded = isToolSelected(tool);
            const clickable = tool.available && !alreadyAdded;
            return (
              <List.Item
                onClick={() => clickable && handleAddTool(tool)}
                style={{
                  cursor: clickable ? 'pointer' : 'not-allowed',
                  opacity: clickable ? 1 : 0.6,
                  padding: '10px 14px',
                  borderRadius: token.borderRadius,
                  marginBottom: 6,
                  border: `1px solid ${token.colorBorder}`,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (clickable) {
                    e.currentTarget.style.backgroundColor = token.colorBgTextHover;
                    e.currentTarget.style.borderColor = token.colorPrimary;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = token.colorBorder;
                }}
                extra={
                  alreadyAdded ? (
                    <Tag color="green">Added</Tag>
                  ) : (
                    tool.available && (
                      <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddTool(tool);
                        }}
                      >
                        Add
                      </Button>
                    )
                  )
                }
              >
                <List.Item.Meta
                  avatar={
                    tool.available ? (
                      <CheckCircleOutlined style={{ fontSize: 22, color: token.colorSuccess }} />
                    ) : (
                      <CloseCircleOutlined style={{ fontSize: 22, color: token.colorError }} />
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
                        <Text type="secondary"> — Checked out to {tool.checked_out_to}</Text>
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
            );
          }}
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

      {/* Cart */}
      {selectedTools.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Divider titlePlacement="left">
            <Space>
              Selected Tools
              <Badge count={selectedTools.length} style={{ backgroundColor: token.colorPrimary }} />
            </Space>
          </Divider>
          <List
            size="small"
            dataSource={selectedTools}
            renderItem={(tool) => (
              <List.Item
                extra={
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveTool(tool.id)}
                  />
                }
              >
                <Space>
                  <Text strong>{tool.tool_number}</Text>
                  <Text type="secondary">{tool.description}</Text>
                  <Tag>{tool.condition}</Tag>
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button onClick={handleClose} style={{ marginRight: 8 }}>
          Cancel
        </Button>
        <Button
          type="primary"
          disabled={selectedTools.length === 0}
          onClick={() => setStep('user')}
        >
          Continue ({selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''})
        </Button>
      </div>
    </div>
  );

  // ── Step: User Selection ─────────────────────────────────────────────────
  const renderUserStep = () => (
    <div>
      {/* Tool cart summary */}
      <div
        style={{
          background: token.colorBgContainer,
          padding: 12,
          borderRadius: token.borderRadius,
          marginBottom: 16,
          border: `1px solid ${token.colorBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <ToolOutlined />
          <Text strong>{selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''} selected:</Text>
          <Text type="secondary">
            {selectedTools.map((t) => t.tool_number).join(', ')}
          </Text>
        </Space>
        <Button size="small" onClick={() => setStep('tools')}>
          Edit Tools
        </Button>
      </div>

      <Title level={5}>Who is checking out these tools?</Title>
      <UserSearchSelect onChange={(_userId, user) => setSelectedUser(user)} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button onClick={() => setStep('tools')} style={{ marginRight: 8 }}>
          Back
        </Button>
        <Button
          type="primary"
          disabled={!selectedUser}
          onClick={() => {
            setStep('details');
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );

  // ── Step: Checkout Details ───────────────────────────────────────────────
  const renderDetailsStep = () => (
    <div>
      {/* Tool summary */}
      <div
        style={{
          background: token.colorBgContainer,
          padding: 12,
          borderRadius: token.borderRadius,
          marginBottom: 12,
          border: `1px solid ${token.colorBorder}`,
        }}
      >
        <Space>
          <ToolOutlined />
          <Text strong>{selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''}:</Text>
          <Text type="secondary">{selectedTools.map((t) => t.tool_number).join(', ')}</Text>
        </Space>
      </div>

      {/* User summary */}
      <div
        style={{
          background: token.colorSuccessBg,
          padding: 12,
          borderRadius: token.borderRadius,
          marginBottom: 16,
          borderLeft: `4px solid ${token.colorSuccess}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <UserOutlined style={{ color: token.colorSuccess }} />
          <Text strong>Checking out to: {selectedUser?.name}</Text>
          {selectedUser?.department && <Tag color="blue">{selectedUser.department}</Tag>}
        </Space>
        <Button size="small" onClick={() => setStep('user')}>
          Change User
        </Button>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          expected_return_date: dayjs().add(7, 'day'),
          condition_at_checkout: 'Good',
        }}
      >
        <Divider>Checkout Details (applied to all tools)</Divider>

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
          <Input.TextArea rows={3} placeholder="Any notes about this checkout..." />
        </Form.Item>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={() => setStep('user')}>Back</Button>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Checkout {selectedTools.length} Tool{selectedTools.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </Form>
    </div>
  );

  // ── Step: Results ────────────────────────────────────────────────────────
  const renderResultsStep = () => {
    const succeeded = batchResults.filter((r) => r.success).length;
    const failed = batchResults.filter((r) => !r.success).length;

    const columns = [
      {
        title: 'Tool',
        dataIndex: 'tool_number',
        key: 'tool_number',
        render: (val: string | null) => <Text strong>{val ?? '—'}</Text>,
      },
      {
        title: 'Status',
        key: 'status',
        render: (_: unknown, record: BatchCheckoutResult) =>
          record.success ? (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Checked Out
            </Tag>
          ) : (
            <Tag icon={<CloseCircleOutlined />} color="error">
              Failed
            </Tag>
          ),
      },
      {
        title: 'Detail',
        key: 'detail',
        render: (_: unknown, record: BatchCheckoutResult) =>
          record.success ? (
            <Text type="secondary">
              Return by{' '}
              {record.checkout?.expected_return_date
                ? dayjs(record.checkout.expected_return_date).format('MMM D, YYYY')
                : '—'}
            </Text>
          ) : (
            <Text type="danger">{record.error}</Text>
          ),
      },
    ];

    return (
      <div>
        <Result
          status={failed === 0 ? 'success' : succeeded > 0 ? 'warning' : 'error'}
          title={
            failed === 0
              ? `All ${succeeded} tool${succeeded !== 1 ? 's' : ''} checked out successfully`
              : succeeded > 0
              ? `${succeeded} succeeded, ${failed} failed`
              : 'All checkouts failed'
          }
          subTitle={`Checked out to ${selectedUser?.name}`}
          style={{ paddingTop: 16, paddingBottom: 8 }}
        />

        <Table
          dataSource={batchResults}
          columns={columns}
          rowKey="tool_id"
          size="small"
          pagination={false}
          style={{ marginTop: 8 }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
          {failed > 0 && (
            <Button
              onClick={() => {
                const failedTools = selectedTools.filter((t) =>
                  batchResults.some((r) => r.tool_id === t.id && !r.success)
                );
                setSelectedTools(failedTools);
                setBatchResults([]);
                form.resetFields();
                setStep('user');
              }}
            >
              Retry Failed ({failed})
            </Button>
          )}
          <Button type="primary" onClick={handleClose}>
            Done
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <ToolOutlined />
          Checkout Tools
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={720}
      footer={null}
      destroyOnClose
    >
      {step !== 'results' && (
        <Steps
          current={stepIndex[step]}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: 'Select Tools', icon: <ToolOutlined /> },
            { title: 'Select User', icon: <UserOutlined /> },
            { title: 'Details', icon: <CheckCircleOutlined /> },
          ]}
        />
      )}

      {step === 'tools' && renderToolStep()}
      {step === 'user' && renderUserStep()}
      {step === 'details' && renderDetailsStep()}
      {step === 'results' && renderResultsStep()}
    </Modal>
  );
};
