import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Form,
  List,
  Tag,
  Alert,
  Spin,
  Table,
  Badge,
  Empty,
  Switch,
  message,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SwapOutlined,
  WarningOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ToolOutlined,
  UserOutlined,
  RollbackOutlined,
  HistoryOutlined,
  PlusOutlined,
  DeleteOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetCheckoutStatsQuery,
  useGetActiveCheckoutsQuery,
  useLazySearchToolsForCheckoutQuery,
  useCreateCheckoutMutation,
  useLazyGetUserCheckoutsQuery,
} from '../services/checkoutApi';
import { useGetUsersQuery } from '@features/users/services/usersApi';
import { CheckinModal } from '../components/CheckinModal';
import { MobileToolCheckout } from '../components/mobile';
import { useIsMobile } from '@shared/hooks/useMobile';
import { useTheme } from '@features/settings/contexts/ThemeContext';
import type { ToolCheckout, ToolSearchResult } from '../types';

const { Title, Text } = Typography;

export const ToolCheckoutPage = () => {
  const isMobile = useIsMobile();
  const { themeConfig } = useTheme();
  const isDarkMode = themeConfig.mode === 'dark';
  const [form] = Form.useForm();

  // Tool search state
  const [toolSearchTerm, setToolSearchTerm] = useState('');
  const [toolSearchResults, setToolSearchResults] = useState<ToolSearchResult[]>([]);

  // Selected tools for batch checkout (cart)
  const [selectedTools, setSelectedTools] = useState<ToolSearchResult[]>([]);

  // User selection for checkout
  const [checkoutUserId, setCheckoutUserId] = useState<number | null>(null);

  // User lookup state (right panel)
  const [lookupUserId, setLookupUserId] = useState<number | null>(null);
  const [includeReturnedForUser, setIncludeReturnedForUser] = useState(false);

  // Active checkouts state
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  // Checkin modal state
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<ToolCheckout | null>(null);

  // Checkout in progress tracking
  const [checkoutProgress, setCheckoutProgress] = useState<{
    current: number;
    total: number;
    inProgress: boolean;
  }>({ current: 0, total: 0, inProgress: false });

  // API queries
  const { data: stats, isLoading: statsLoading } = useGetCheckoutStatsQuery();
  const { data: activeCheckoutsData, isLoading: activeLoading } = useGetActiveCheckoutsQuery({
    q: activeSearchTerm || undefined,
    per_page: 100,
  });
  const { data: usersData } = useGetUsersQuery();

  // Lazy queries
  const [searchTools, { isLoading: searchingTools }] = useLazySearchToolsForCheckoutQuery();
  const [getUserCheckouts, { data: userCheckoutsData, isLoading: userCheckoutsLoading }] =
    useLazyGetUserCheckoutsQuery();

  // Mutations
  const [createCheckout] = useCreateCheckoutMutation();

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileToolCheckout />;
  }

  // Debounced tool search
  useEffect(() => {
    if (toolSearchTerm.length >= 2) {
      const timer = setTimeout(async () => {
        const result = await searchTools(toolSearchTerm).unwrap();
        setToolSearchResults(result.tools || []);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setToolSearchResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [toolSearchTerm, searchTools]);

  // Load user checkouts when user is selected for lookup
  useEffect(() => {
    if (lookupUserId) {
      getUserCheckouts({
        userId: lookupUserId,
        params: { include_returned: includeReturnedForUser },
      });
    }
  }, [lookupUserId, includeReturnedForUser, getUserCheckouts]);

  const handleAddTool = (tool: ToolSearchResult) => {
    // Check if already in cart
    if (selectedTools.some((t) => t.id === tool.id)) {
      message.warning(`${tool.tool_number} is already in the checkout list`);
      return;
    }
    setSelectedTools([...selectedTools, tool]);
    setToolSearchTerm('');
    setToolSearchResults([]);
    message.success(`Added ${tool.tool_number} to checkout list`);
  };

  const handleRemoveTool = (toolId: number) => {
    setSelectedTools(selectedTools.filter((t) => t.id !== toolId));
  };

  const handleClearAll = () => {
    setSelectedTools([]);
    setCheckoutUserId(null);
    form.resetFields();
  };

  const handleCheckout = async (values: Record<string, unknown>) => {
    if (selectedTools.length === 0) {
      message.error('Please add at least one tool to checkout');
      return;
    }

    if (!checkoutUserId) {
      message.error('Please select who to check the tools out to');
      return;
    }

    const selectedUser = usersData?.find((u) => u.id === checkoutUserId);
    const toolCount = selectedTools.length;

    setCheckoutProgress({ current: 0, total: toolCount, inProgress: true });

    let successCount = 0;
    const failedTools: string[] = [];

    for (let i = 0; i < selectedTools.length; i++) {
      const tool = selectedTools[i];
      setCheckoutProgress({ current: i + 1, total: toolCount, inProgress: true });

      try {
        await createCheckout({
          tool_id: tool.id,
          user_id: checkoutUserId,
          expected_return_date: values.expected_return_date
            ? (values.expected_return_date as dayjs.Dayjs).toISOString()
            : undefined,
          notes: values.notes as string | undefined,
          work_order: values.work_order as string | undefined,
          project: values.project as string | undefined,
        }).unwrap();
        successCount++;
      } catch (error: unknown) {
        const err = error as { data?: { error?: string } };
        failedTools.push(`${tool.tool_number}: ${err.data?.error || 'Failed'}`);
      }
    }

    setCheckoutProgress({ current: 0, total: 0, inProgress: false });

    if (successCount === toolCount) {
      message.success(
        `Successfully checked out ${toolCount} tool${toolCount > 1 ? 's' : ''} to ${selectedUser?.name || 'mechanic'}`
      );
      handleClearAll();
    } else if (successCount > 0) {
      message.warning(
        `Checked out ${successCount} of ${toolCount} tools. Failed: ${failedTools.join(', ')}`
      );
      // Remove successful tools from the list
      const failedToolNumbers = failedTools.map((f) => f.split(':')[0]);
      setSelectedTools(selectedTools.filter((t) => failedToolNumbers.includes(t.tool_number)));
    } else {
      message.error(`Failed to checkout tools: ${failedTools.join(', ')}`);
    }
  };

  const handleCheckin = (checkout: ToolCheckout) => {
    setSelectedCheckout(checkout);
    setCheckinModalOpen(true);
  };

  const handleCheckinClose = () => {
    setCheckinModalOpen(false);
    setSelectedCheckout(null);
  };

  const getStatusColor = (available: boolean, status: string) => {
    if (available) return 'success';
    if (status === 'checked_out') return 'warning';
    return 'error';
  };

  const isToolInCart = (toolId: number) => selectedTools.some((t) => t.id === toolId);

  // Active checkouts table columns
  const activeCheckoutsColumns: ColumnsType<ToolCheckout> = [
    {
      title: 'Tool',
      key: 'tool',
      render: (_, record) => (
        <div>
          <Text strong>{record.tool_number}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.serial_number}
          </Text>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'tool_description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Checked Out To',
      key: 'user',
      render: (_, record) => (
        <div>
          <Text>{record.user_name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.user_department}
          </Text>
        </div>
      ),
    },
    {
      title: 'Checkout Date',
      dataIndex: 'checkout_date',
      key: 'checkout_date',
      render: (date: string) => dayjs(date).format('MMM D, YYYY'),
      sorter: (a, b) => dayjs(a.checkout_date).unix() - dayjs(b.checkout_date).unix(),
    },
    {
      title: 'Due Date',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
      render: (date: string | null, record) => {
        if (!date) return <Text type="secondary">No due date</Text>;
        const isOverdue = record.is_overdue;
        return (
          <Text type={isOverdue ? 'danger' : undefined}>
            {dayjs(date).format('MMM D, YYYY')}
            {isOverdue && ` (${record.days_overdue}d overdue)`}
          </Text>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) =>
        record.is_overdue ? (
          <Tag color="error">Overdue</Tag>
        ) : (
          <Tag color="processing">Checked Out</Tag>
        ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<RollbackOutlined />}
          onClick={() => handleCheckin(record)}
        >
          Return
        </Button>
      ),
    },
  ];

  // User checkouts table columns (for lookup panel)
  const userCheckoutsColumns: ColumnsType<ToolCheckout> = [
    {
      title: 'Tool',
      key: 'tool',
      render: (_, record) => (
        <div>
          <Text strong>{record.tool_number}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.tool_description}
          </Text>
        </div>
      ),
    },
    {
      title: 'Checkout Date',
      dataIndex: 'checkout_date',
      key: 'checkout_date',
      render: (date: string) => dayjs(date).format('MMM D, YYYY'),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        if (record.return_date) {
          return <Tag color="success">Returned</Tag>;
        }
        if (record.is_overdue) {
          return <Tag color="error">Overdue ({record.days_overdue}d)</Tag>;
        }
        return <Tag color="processing">Checked Out</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) =>
        !record.return_date && (
          <Button
            type="primary"
            size="small"
            icon={<RollbackOutlined />}
            onClick={() => handleCheckin(record)}
          >
            Return
          </Button>
        ),
    },
  ];

  // Cart table columns
  const cartColumns: ColumnsType<ToolSearchResult> = [
    {
      title: 'Tool',
      key: 'tool',
      render: (_, record) => (
        <div>
          <Text strong>{record.tool_number}</Text>
          <Text type="secondary" style={{ marginLeft: 8 }}>
            ({record.serial_number})
          </Text>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Condition',
      dataIndex: 'condition',
      key: 'condition',
      width: 100,
      render: (condition: string) => <Tag>{condition}</Tag>,
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveTool(record.id)}
        />
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          Tool Room
        </Title>
        <Text type="secondary">
          Check tools in and out to mechanics, view active checkouts, and manage returns
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading} size="small">
            <Statistic
              title="Active Checkouts"
              value={stats?.active_checkouts || 0}
              prefix={<SwapOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading} size="small">
            <Statistic
              title="Overdue"
              value={stats?.overdue_checkouts || 0}
              prefix={<WarningOutlined />}
              valueStyle={{
                color: stats?.overdue_checkouts ? '#ff4d4f' : '#52c41a',
              }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading} size="small">
            <Statistic
              title="Today's Checkouts"
              value={stats?.checkouts_today || 0}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading} size="small">
            <Statistic
              title="Today's Returns"
              value={stats?.returns_today || 0}
              prefix={<HistoryOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Left Column: Checkout Form */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ToolOutlined />
                <span>Check Out Tools to Mechanic</span>
                {selectedTools.length > 0 && (
                  <Badge
                    count={selectedTools.length}
                    style={{ backgroundColor: '#52c41a' }}
                  />
                )}
              </Space>
            }
            style={{ height: '100%' }}
          >
            {/* Step 1: Select User */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                <UserOutlined /> Step 1: Select Mechanic
              </Text>
              <Select
                placeholder="Search for mechanic by name or employee number..."
                showSearch
                allowClear
                style={{ width: '100%' }}
                value={checkoutUserId}
                onChange={setCheckoutUserId}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={usersData?.map((user) => ({
                  value: user.id,
                  label: `${user.name} (${user.employee_number}) - ${user.department}`,
                }))}
                size="large"
              />
              {checkoutUserId && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: isDarkMode ? 'rgba(82, 196, 26, 0.1)' : '#f6ffed',
                    borderRadius: 4,
                    border: `1px solid ${isDarkMode ? 'rgba(82, 196, 26, 0.3)' : '#b7eb8f'}`,
                  }}
                >
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  <Text>
                    Checking out to:{' '}
                    <Text strong>{usersData?.find((u) => u.id === checkoutUserId)?.name}</Text>
                  </Text>
                </div>
              )}
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* Step 2: Add Tools */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                <ToolOutlined /> Step 2: Add Tools
              </Text>

              <Input
                placeholder="Search by tool number, serial number, or description..."
                prefix={<SearchOutlined />}
                value={toolSearchTerm}
                onChange={(e) => setToolSearchTerm(e.target.value)}
                size="large"
                disabled={!checkoutUserId}
              />

              {!checkoutUserId && (
                <Alert
                  type="info"
                  message="Select a mechanic first"
                  style={{ marginTop: 16 }}
                  showIcon
                />
              )}

              {/* Search Results */}
              {checkoutUserId && searchingTools && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin tip="Searching..." />
                </div>
              )}

              {checkoutUserId && toolSearchResults.length > 0 && (
                <List
                  style={{ marginTop: 16, maxHeight: 200, overflow: 'auto' }}
                  dataSource={toolSearchResults}
                  renderItem={(tool) => {
                    const inCart = isToolInCart(tool.id);
                    return (
                      <List.Item
                        style={{
                          cursor: tool.available && !inCart ? 'pointer' : 'not-allowed',
                          opacity: tool.available && !inCart ? 1 : 0.6,
                          padding: '8px 12px',
                          borderRadius: 6,
                          marginBottom: 4,
                          border: `1px solid ${isDarkMode ? '#424242' : '#d9d9d9'}`,
                          background: inCart
                            ? isDarkMode
                              ? 'rgba(82, 196, 26, 0.1)'
                              : '#f6ffed'
                            : isDarkMode
                              ? '#1f1f1f'
                              : 'transparent',
                        }}
                        onClick={() => tool.available && !inCart && handleAddTool(tool)}
                      >
                        <div style={{ flex: 1 }}>
                          <Space>
                            {tool.available ? (
                              inCart ? (
                                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                              ) : (
                                <PlusOutlined style={{ color: '#1890ff' }} />
                              )
                            ) : (
                              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                            )}
                            <Text strong>{tool.tool_number}</Text>
                            <Text type="secondary">({tool.serial_number})</Text>
                            <Tag color={getStatusColor(tool.available, tool.status)}>
                              {inCart ? 'In Cart' : tool.available ? 'Available' : tool.status.replace('_', ' ')}
                            </Tag>
                          </Space>
                          <div style={{ marginLeft: 24 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {tool.description}
                            </Text>
                          </div>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              )}

              {checkoutUserId &&
                toolSearchTerm.length >= 2 &&
                !searchingTools &&
                toolSearchResults.length === 0 && (
                  <Alert
                    type="info"
                    message="No tools found"
                    description="Try a different search term"
                    style={{ marginTop: 16 }}
                  />
                )}
            </div>

            {/* Selected Tools Cart */}
            {selectedTools.length > 0 && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Text strong>
                      <ShoppingCartOutlined /> Tools to Check Out ({selectedTools.length})
                    </Text>
                    <Button size="small" danger onClick={() => setSelectedTools([])}>
                      Clear All
                    </Button>
                  </div>
                  <Table
                    dataSource={selectedTools}
                    columns={cartColumns}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ y: 150 }}
                  />
                </div>
              </>
            )}

            {/* Checkout Form */}
            {selectedTools.length > 0 && checkoutUserId && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleCheckout}
                  initialValues={{
                    expected_return_date: dayjs().add(7, 'day'),
                  }}
                  size="small"
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="Expected Return Date"
                        name="expected_return_date"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <DatePicker
                          style={{ width: '100%' }}
                          disabledDate={(current) => current && current < dayjs().startOf('day')}
                          format="YYYY-MM-DD"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Work Order" name="work_order">
                        <Input placeholder="Optional" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="Project" name="project">
                        <Input placeholder="Optional" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Notes" name="notes">
                        <Input placeholder="Optional" />
                      </Form.Item>
                    </Col>
                  </Row>

                  {checkoutProgress.inProgress && (
                    <Alert
                      type="info"
                      message={`Checking out tool ${checkoutProgress.current} of ${checkoutProgress.total}...`}
                      style={{ marginBottom: 16 }}
                      showIcon
                    />
                  )}

                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={checkoutProgress.inProgress}
                    block
                    size="large"
                  >
                    <SwapOutlined /> Check Out {selectedTools.length} Tool
                    {selectedTools.length > 1 ? 's' : ''} to{' '}
                    {usersData?.find((u) => u.id === checkoutUserId)?.name || 'Mechanic'}
                  </Button>
                </Form>
              </>
            )}

            {selectedTools.length === 0 && checkoutUserId && toolSearchTerm.length < 2 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Search and add tools to check out"
                style={{ marginTop: 20 }}
              />
            )}
          </Card>
        </Col>

        {/* Right Column: User Lookup */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <UserOutlined />
                <span>Mechanic Tool Lookup</span>
              </Space>
            }
            extra={
              lookupUserId && (
                <Space>
                  <Text type="secondary">Include returned:</Text>
                  <Switch
                    size="small"
                    checked={includeReturnedForUser}
                    onChange={setIncludeReturnedForUser}
                  />
                </Space>
              )
            }
            style={{ height: '100%' }}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Look up what tools a mechanic currently has checked out
            </Text>
            <Select
              placeholder="Search for mechanic..."
              showSearch
              allowClear
              style={{ width: '100%', marginBottom: 16 }}
              value={lookupUserId}
              onChange={setLookupUserId}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={usersData?.map((user) => ({
                value: user.id,
                label: `${user.name} (${user.employee_number}) - ${user.department}`,
              }))}
              size="large"
            />

            {!lookupUserId && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Select a mechanic to see their checked out tools"
              />
            )}

            {lookupUserId && userCheckoutsLoading && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin tip="Loading..." />
              </div>
            )}

            {lookupUserId && !userCheckoutsLoading && userCheckoutsData && (
              <div>
                {/* User Info */}
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    background: isDarkMode ? '#1f1f1f' : '#fafafa',
                    borderRadius: 8,
                  }}
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text type="secondary">Name:</Text>
                      <br />
                      <Text strong>{userCheckoutsData.user.name}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">Employee #:</Text>
                      <br />
                      <Text strong>{userCheckoutsData.user.employee_number}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">Tools Out:</Text>
                      <br />
                      <Text
                        strong
                        style={{
                          color:
                            userCheckoutsData.checkouts.filter((c) => !c.return_date).length > 0
                              ? '#1890ff'
                              : undefined,
                        }}
                      >
                        {userCheckoutsData.checkouts.filter((c) => !c.return_date).length}
                      </Text>
                    </Col>
                  </Row>
                </div>

                {/* User Checkouts Table */}
                <Table
                  dataSource={userCheckoutsData.checkouts}
                  columns={userCheckoutsColumns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 5, size: 'small' }}
                  scroll={{ y: 300 }}
                  locale={{ emptyText: 'No tools checked out' }}
                  rowClassName={(record) =>
                    !record.return_date && record.is_overdue ? 'ant-table-row-overdue' : ''
                  }
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Active Checkouts Table */}
      <Card
        title={
          <Space>
            <SwapOutlined />
            <span>All Active Checkouts</span>
            {stats && stats.active_checkouts > 0 && (
              <Badge count={stats.active_checkouts} style={{ backgroundColor: '#1890ff' }} />
            )}
          </Space>
        }
        style={{ marginTop: 16 }}
        extra={
          <Input
            placeholder="Search tools or mechanics..."
            prefix={<SearchOutlined />}
            value={activeSearchTerm}
            onChange={(e) => setActiveSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
        }
      >
        <Table
          dataSource={activeCheckoutsData?.checkouts || []}
          columns={activeCheckoutsColumns}
          rowKey="id"
          loading={activeLoading}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'] }}
          rowClassName={(record) => (record.is_overdue ? 'ant-table-row-overdue' : '')}
          locale={{ emptyText: 'No active checkouts' }}
        />
      </Card>

      {/* Check-in Modal */}
      <CheckinModal
        open={checkinModalOpen}
        checkout={selectedCheckout}
        onClose={handleCheckinClose}
      />

      <style>{`
        .ant-table-row-overdue > td {
          background-color: ${isDarkMode ? 'rgba(255, 77, 79, 0.15)' : '#fff2f0'} !important;
        }
        .ant-table-row-overdue:hover > td {
          background-color: ${isDarkMode ? 'rgba(255, 77, 79, 0.25)' : '#ffccc7'} !important;
        }
      `}</style>
    </div>
  );
};

export default ToolCheckoutPage;
