import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Space,
  Button,
  Input,
  Select,
  Tag,
  Row,
  Col,
  Statistic,
  Empty,
  Tabs,
  Badge,
  theme,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetOrdersQuery } from '../services/ordersApi';
import { useGetRequestsQuery } from '../services/requestsApi';
import {
  StatusBadge,
  PriorityBadge,
  ItemTypeBadge,
  MobileOrdersList,
  ProcessRequestModal,
} from '../components';
import { useIsMobile } from '@shared/hooks/useMobile';
import type {
  ProcurementOrder,
  OrderStatus,
  OrderPriority,
  OrderType,
  UserRequest,
  RequestStatus,
  RequestPriority,
  UnifiedItem,
} from '../types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const { Option } = Select;
const { useToken } = theme;

export const OrdersDashboard: React.FC = () => {
  const { token } = useToken();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('needs_processing');

  // Unified state management
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<(OrderPriority | RequestPriority)[]>([]);
  const [typeFilter, setTypeFilter] = useState<OrderType[]>([]);

  // ProcessRequestModal state
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  // Helper functions for tab-based status filtering
  const getRequestStatusForTab = (tab: string): string | undefined => {
    switch (tab) {
      case 'needs_processing':
        return 'new,awaiting_info,in_progress';
      case 'in_transit':
        return 'partially_ordered,ordered,shipped,partially_received';
      case 'completed':
        return 'received,cancelled';
      default:
        return undefined;
    }
  };

  const getOrderStatusForTab = (tab: string): string | undefined => {
    switch (tab) {
      case 'needs_processing':
        return 'new,awaiting_info,in_progress';
      case 'in_transit':
        return 'ordered,shipped';
      case 'completed':
        return 'received,cancelled';
      default:
        return undefined;
    }
  };

  // Build query params based on active tab
  const requestQueryParams = {
    search: searchQuery || undefined,
    priority: priorityFilter.length > 0 ? priorityFilter.join(',') : undefined,
    status: getRequestStatusForTab(activeTab),
  };

  const orderQueryParams = {
    search: searchQuery || undefined,
    priority: priorityFilter.length > 0 ? priorityFilter.join(',') : undefined,
    order_type: typeFilter.length > 0 ? typeFilter.join(',') : undefined,
    status: getOrderStatusForTab(activeTab),
  };

  const { data: requests = [], isLoading: requestsLoading, refetch: refetchRequests } =
    useGetRequestsQuery(requestQueryParams);
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } =
    useGetOrdersQuery(orderQueryParams);

  // Create unified data structure
  const combinedItems = useMemo(() => {
    const requestItems: UnifiedItem[] = requests.map((r) => ({
      ...r,
      itemType: 'request' as const,
      displayNumber: r.request_number,
    }));
    const orderItems: UnifiedItem[] = orders.map((o) => ({
      ...o,
      itemType: 'order' as const,
      displayNumber: o.order_number,
    }));
    return [...requestItems, ...orderItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [requests, orders]);

  // Calculate counts for badges
  const needsProcessingCount = useMemo(() => {
    const requestCount = requests.filter((r) =>
      ['new', 'awaiting_info', 'in_progress'].includes(r.status)
    ).length;
    const orderCount = orders.filter((o) =>
      ['new', 'awaiting_info', 'in_progress'].includes(o.status)
    ).length;
    return requestCount + orderCount;
  }, [requests, orders]);

  const inTransitCount = useMemo(() => {
    const requestCount = requests.filter((r) =>
      ['partially_ordered', 'ordered', 'shipped', 'partially_received'].includes(r.status)
    ).length;
    const orderCount = orders.filter((o) => ['ordered', 'shipped'].includes(o.status)).length;
    return requestCount + orderCount;
  }, [requests, orders]);

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileOrdersList />;
  }

  const handleCreateOrder = () => {
    navigate('/orders/new');
  };

  const handleProcessRequest = (requestId: number) => {
    setSelectedRequestId(requestId);
    setProcessModalOpen(true);
  };

  const handleViewItem = (item: UnifiedItem) => {
    if (item.itemType === 'request') {
      navigate(`/requests/${item.id}`);
    } else {
      navigate(`/orders/${item.id}`);
    }
  };

  const handleRefresh = () => {
    refetchRequests();
    refetchOrders();
  };

  // Unified columns handling both requests and orders
  const unifiedColumns: ColumnsType<UnifiedItem> = [
    {
      title: 'Number',
      dataIndex: 'displayNumber',
      key: 'displayNumber',
      fixed: 'left',
      width: 150,
      render: (number, record) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            onClick={() => handleViewItem(record)}
            style={{ padding: 0, fontWeight: 700, fontSize: 14 }}
          >
            {number}
          </Button>
          <Tag color={record.itemType === 'request' ? 'blue' : 'green'} style={{ fontSize: 11 }}>
            {record.itemType === 'request' ? 'Request' : 'Order'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 280,
      ellipsis: true,
      render: (title: string, record: UnifiedItem) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{title}</span>
          {record.itemType === 'order' && (record as ProcurementOrder).part_number && (
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
              PN: {(record as ProcurementOrder).part_number}
            </span>
          )}
          {record.itemType === 'request' && (record as UserRequest).item_count && (
            <Badge
              count={(record as UserRequest).item_count}
              showZero
              style={{ fontSize: 11, backgroundColor: token.colorPrimary }}
            />
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'itemType',
      key: 'itemType',
      width: 120,
      render: (_, record: UnifiedItem) => {
        if (record.itemType === 'order' && (record as ProcurementOrder).order_type) {
          return <ItemTypeBadge type={(record as ProcurementOrder).order_type!} />;
        }
        return <Tag color="blue">Multi-Item</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status: RequestStatus | OrderStatus, record: UnifiedItem) => (
        <StatusBadge status={status} type={record.itemType} />
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: RequestPriority | OrderPriority) => <PriorityBadge priority={priority} />,
    },
    {
      title: 'Requester',
      dataIndex: 'requester',
      key: 'requester',
      width: 150,
      ellipsis: true,
      render: (requester: { first_name: string; last_name: string } | undefined) =>
        requester ? `${requester.first_name} ${requester.last_name}` : '-',
    },
    {
      title: 'Buyer',
      dataIndex: 'buyer',
      key: 'buyer',
      width: 150,
      ellipsis: true,
      render: (buyer: { first_name: string; last_name: string } | undefined) =>
        buyer ? `${buyer.first_name} ${buyer.last_name}` : <Tag>Unassigned</Tag>,
    },
    {
      title: 'Due Date',
      dataIndex: 'expected_due_date',
      key: 'expected_due_date',
      width: 150,
      render: (dueDate: string, record: UnifiedItem) => {
        if (!dueDate) return '-';
        const isOverdue = record.is_late;
        const isDueSoon = 'due_soon' in record && record.due_soon;

        return (
          <Space direction="vertical" size={0}>
            <span style={{ color: isOverdue ? token.colorError : undefined }}>
              {dayjs(dueDate).format('MMM D, YYYY')}
            </span>
            <span style={{ fontSize: 12, color: isOverdue ? token.colorError : token.colorTextSecondary }}>
              {dayjs(dueDate).fromNow()}
            </span>
            {isOverdue && <Tag color="red">Overdue</Tag>}
            {isDueSoon && !isOverdue && <Tag color="orange">Due Soon</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (createdAt: string) => dayjs(createdAt).format('MMM D, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record: UnifiedItem) => {
        if (record.itemType === 'request' && activeTab === 'needs_processing') {
          return (
            <Button type="primary" size="small" onClick={() => handleProcessRequest(record.id)}>
              Process
            </Button>
          );
        }
        return (
          <Button size="small" onClick={() => handleViewItem(record)}>
            View
          </Button>
        );
      },
    },
  ];

  const renderTabContent = (tab: string) => {
    const isLoading = requestsLoading || ordersLoading;

    return (
      <>
        {/* Analytics Row */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Items"
                value={combinedItems.length}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={tab === 'needs_processing' ? 'Needs Processing' : tab === 'in_transit' ? 'In Transit' : 'Completed'}
                value={combinedItems.length}
                prefix={
                  tab === 'needs_processing' ? (
                    <ClockCircleOutlined />
                  ) : tab === 'in_transit' ? (
                    <ShoppingCartOutlined />
                  ) : (
                    <CheckCircleOutlined />
                  )
                }
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Requests"
                value={requests.length}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: token.colorPrimary }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Orders"
                value={orders.length}
                prefix={<ShoppingCartOutlined />}
                valueStyle={{ color: token.colorSuccess }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Input
                placeholder="Search by number, title, or description..."
                prefix={<SearchOutlined />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
              />
            </Col>
            <Col span={8}>
              <Select
                mode="multiple"
                placeholder="Filter by priority"
                value={priorityFilter}
                onChange={setPriorityFilter}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="low">Low</Option>
                <Option value="normal">Normal</Option>
                <Option value="high">High</Option>
                <Option value="critical">Critical</Option>
              </Select>
            </Col>
            <Col span={8}>
              <Select
                mode="multiple"
                placeholder="Filter by type (orders only)"
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="tool">Tool</Option>
                <Option value="chemical">Chemical</Option>
                <Option value="expendable">Expendable</Option>
                <Option value="kit">Kit</Option>
              </Select>
            </Col>
          </Row>
        </Card>

        {/* Unified Table */}
        <Card>
          <Table
            columns={unifiedColumns}
            dataSource={combinedItems}
            rowKey={(record) => `${record.itemType}-${record.id}`}
            loading={isLoading}
            scroll={{ x: 1400 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} items`,
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span>
                      No items found
                      {tab === 'needs_processing' && (
                        <>
                          <br />
                          <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                            All requests and orders are either in transit or completed
                          </span>
                        </>
                      )}
                    </span>
                  }
                />
              ),
            }}
          />
        </Card>
      </>
    );
  };

  // Tab items with workflow stages
  const tabItems = [
    {
      key: 'needs_processing',
      label: (
        <span>
          <ClockCircleOutlined />
          Needs Processing
          {needsProcessingCount > 0 && (
            <Badge count={needsProcessingCount} style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
      children: renderTabContent('needs_processing'),
    },
    {
      key: 'in_transit',
      label: (
        <span>
          <ShoppingCartOutlined />
          In Transit
          {inTransitCount > 0 && <Badge count={inTransitCount} style={{ marginLeft: 8 }} />}
        </span>
      ),
      children: renderTabContent('in_transit'),
    },
    {
      key: 'completed',
      label: (
        <span>
          <CheckCircleOutlined />
          Completed
        </span>
      ),
      children: renderTabContent('completed'),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
              <ShoppingCartOutlined style={{ marginRight: 12 }} />
              Procurement Management
            </h1>
            <p style={{ margin: '4px 0 0', color: token.colorTextSecondary }}>
              Process requests and manage procurement orders
            </p>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateOrder}
                size="large"
              >
                Create Order
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* Process Request Modal */}
      <ProcessRequestModal
        open={processModalOpen}
        requestId={selectedRequestId}
        onClose={() => {
          setProcessModalOpen(false);
          setSelectedRequestId(null);
        }}
        onSuccess={() => {
          handleRefresh();
        }}
      />
    </div>
  );
};
