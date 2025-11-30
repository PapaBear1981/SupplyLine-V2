import { useState } from 'react';
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
  Tooltip,
  Tabs,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetOrdersQuery, useGetOrderAnalyticsQuery } from '../services/ordersApi';
import { useGetRequestsQuery, useGetRequestAnalyticsQuery } from '../services/requestsApi';
import { StatusBadge, PriorityBadge, ItemTypeBadge } from '../components';
import type { ProcurementOrder, OrderStatus, OrderPriority, OrderType, UserRequest, RequestStatus, RequestPriority } from '../types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const { Option } = Select;

export const OrdersDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('requests');

  // Orders state
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus[]>([]);
  const [orderPriorityFilter, setOrderPriorityFilter] = useState<OrderPriority[]>([]);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType[]>([]);

  // Requests state
  const [requestSearchQuery, setRequestSearchQuery] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatus[]>([]);
  const [requestPriorityFilter, setRequestPriorityFilter] = useState<RequestPriority[]>([]);

  // Build order query params
  const orderQueryParams = {
    search: orderSearchQuery || undefined,
    status: orderStatusFilter.length > 0 ? orderStatusFilter.join(',') : undefined,
    priority: orderPriorityFilter.length > 0 ? orderPriorityFilter.join(',') : undefined,
    order_type: orderTypeFilter.length > 0 ? orderTypeFilter.join(',') : undefined,
  };

  // Build request query params
  const requestQueryParams = {
    search: requestSearchQuery || undefined,
    status: requestStatusFilter.length > 0 ? requestStatusFilter.join(',') : undefined,
    priority: requestPriorityFilter.length > 0 ? requestPriorityFilter.join(',') : undefined,
  };

  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useGetOrdersQuery(orderQueryParams);
  const { data: orderAnalytics } = useGetOrderAnalyticsQuery();
  const { data: requests = [], isLoading: requestsLoading, refetch: refetchRequests } = useGetRequestsQuery(requestQueryParams);
  const { data: requestAnalytics } = useGetRequestAnalyticsQuery();

  // Count pending requests (new, in_progress) that need processing
  const pendingRequestsCount = requests.filter(
    (r) => ['new', 'in_progress', 'awaiting_info'].includes(r.status)
  ).length;

  const handleCreateOrder = () => {
    navigate('/orders/new');
  };

  const handleViewOrder = (orderId: number) => {
    navigate(`/orders/${orderId}`);
  };

  const handleViewRequest = (requestId: number) => {
    navigate(`/requests/${requestId}`);
  };

  const handleRefresh = () => {
    if (activeTab === 'orders') {
      refetchOrders();
    } else {
      refetchRequests();
    }
  };

  // Request columns - emphasizing request number for tracking
  const requestColumns: ColumnsType<UserRequest> = [
    {
      title: 'Request #',
      dataIndex: 'request_number',
      key: 'request_number',
      fixed: 'left',
      width: 130,
      render: (requestNumber: string, record: UserRequest) => (
        <Button
          type="link"
          onClick={() => handleViewRequest(record.id)}
          style={{ padding: 0, fontWeight: 700, fontSize: 14 }}
        >
          {requestNumber}
        </Button>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
      render: (title: string) => <span style={{ fontWeight: 500 }}>{title}</span>,
    },
    {
      title: 'Items',
      dataIndex: 'item_count',
      key: 'item_count',
      width: 80,
      render: (count: number) => <Badge count={count || 0} showZero style={{ backgroundColor: '#1890ff' }} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status: RequestStatus) => <StatusBadge status={status} type="request" />,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: RequestPriority) => <PriorityBadge priority={priority} />,
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
      title: 'Due Date',
      dataIndex: 'expected_due_date',
      key: 'expected_due_date',
      width: 140,
      render: (dueDate: string, record: UserRequest) => {
        if (!dueDate) return '-';
        return (
          <Space direction="vertical" size={0}>
            <span style={{ color: record.is_late ? '#ff4d4f' : undefined }}>
              {dayjs(dueDate).format('MMM D, YYYY')}
            </span>
            {record.is_late && <Tag color="red">Overdue</Tag>}
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
      width: 100,
      render: (_, record: UserRequest) => (
        <Button type="primary" size="small" onClick={() => handleViewRequest(record.id)}>
          Process
        </Button>
      ),
    },
  ];

  // Order columns
  const orderColumns: ColumnsType<ProcurementOrder> = [
    {
      title: 'Order #',
      dataIndex: 'order_number',
      key: 'order_number',
      fixed: 'left',
      width: 120,
      render: (orderNumber: string, record: ProcurementOrder) => (
        <Button
          type="link"
          onClick={() => handleViewOrder(record.id)}
          style={{ padding: 0, fontWeight: 600 }}
        >
          {orderNumber}
        </Button>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
      render: (title: string, record: ProcurementOrder) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{title}</span>
          {record.part_number && (
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>PN: {record.part_number}</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'order_type',
      key: 'order_type',
      width: 120,
      render: (type: OrderType) => type && <ItemTypeBadge type={type} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: OrderStatus) => <StatusBadge status={status} type="order" />,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: OrderPriority) => <PriorityBadge priority={priority} />,
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
      title: 'Vendor',
      dataIndex: 'vendor',
      key: 'vendor',
      width: 150,
      ellipsis: true,
      render: (vendor: string) => vendor || '-',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (quantity: number, record: ProcurementOrder) =>
        quantity ? `${quantity} ${record.unit || ''}` : '-',
    },
    {
      title: 'Due Date',
      dataIndex: 'expected_due_date',
      key: 'expected_due_date',
      width: 150,
      render: (dueDate: string, record: ProcurementOrder) => {
        if (!dueDate) return '-';
        const isOverdue = record.is_late;
        const isDueSoon = record.due_soon;

        return (
          <Space direction="vertical" size={0}>
            <span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
              {dayjs(dueDate).format('MMM D, YYYY')}
            </span>
            <span style={{ fontSize: 12, color: isOverdue ? '#ff4d4f' : '#8c8c8c' }}>
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
      width: 100,
      render: (_, record: ProcurementOrder) => (
        <Button size="small" onClick={() => handleViewOrder(record.id)}>
          View
        </Button>
      ),
    },
  ];

  // Tab items for Requests and Orders
  const tabItems = [
    {
      key: 'requests',
      label: (
        <span>
          <FileTextOutlined />
          Requests
          {pendingRequestsCount > 0 && (
            <Badge count={pendingRequestsCount} style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
      children: (
        <>
          {/* Request Analytics */}
          {requestAnalytics && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Requests"
                    value={requestAnalytics.total_count}
                    prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Pending"
                    value={
                      (requestAnalytics.status_breakdown?.new || 0) +
                      (requestAnalytics.status_breakdown?.in_progress || 0) +
                      (requestAnalytics.status_breakdown?.awaiting_info || 0)
                    }
                    prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Overdue"
                    value={requestAnalytics.late_count}
                    prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                    valueStyle={{ color: requestAnalytics.late_count > 0 ? '#ff4d4f' : undefined }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Completed"
                    value={requestAnalytics.status_breakdown?.received || 0}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Request Filters */}
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={10}>
                <Input
                  placeholder="Search by request number, title..."
                  prefix={<SearchOutlined />}
                  value={requestSearchQuery}
                  onChange={(e) => setRequestSearchQuery(e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={24} md={7}>
                <Select
                  mode="multiple"
                  placeholder="Filter by Status"
                  value={requestStatusFilter}
                  onChange={setRequestStatusFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="new">New</Option>
                  <Option value="awaiting_info">Awaiting Info</Option>
                  <Option value="in_progress">In Progress</Option>
                  <Option value="partially_ordered">Partially Ordered</Option>
                  <Option value="ordered">Ordered</Option>
                  <Option value="partially_received">Partially Received</Option>
                  <Option value="received">Received</Option>
                  <Option value="cancelled">Cancelled</Option>
                </Select>
              </Col>
              <Col xs={24} md={7}>
                <Select
                  mode="multiple"
                  placeholder="Filter by Priority"
                  value={requestPriorityFilter}
                  onChange={setRequestPriorityFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="low">Low</Option>
                  <Option value="normal">Normal</Option>
                  <Option value="high">High</Option>
                  <Option value="critical">Critical</Option>
                </Select>
              </Col>
            </Row>
          </Card>

          {/* Requests Table */}
          <Card>
            <Table
              columns={requestColumns}
              dataSource={requests}
              loading={requestsLoading}
              rowKey="id"
              scroll={{ x: 1200 }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} requests`,
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No requests found"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            />
          </Card>
        </>
      ),
    },
    {
      key: 'orders',
      label: (
        <span>
          <ShoppingCartOutlined />
          Orders
        </span>
      ),
      children: (
        <>
          {/* Order Analytics */}
          {orderAnalytics && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Orders"
                    value={orderAnalytics.total_count}
                    prefix={<InboxOutlined style={{ color: '#1890ff' }} />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="In Progress"
                    value={
                      (orderAnalytics.status_breakdown?.new || 0) +
                      (orderAnalytics.status_breakdown?.in_progress || 0) +
                      (orderAnalytics.status_breakdown?.ordered || 0) +
                      (orderAnalytics.status_breakdown?.shipped || 0)
                    }
                    prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Overdue"
                    value={orderAnalytics.late_count}
                    prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                    valueStyle={{ color: orderAnalytics.late_count > 0 ? '#ff4d4f' : undefined }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Completed"
                    value={orderAnalytics.status_breakdown?.received || 0}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Order Filters */}
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Input
                  placeholder="Search orders..."
                  prefix={<SearchOutlined />}
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={24} md={5}>
                <Select
                  mode="multiple"
                  placeholder="Filter by Status"
                  value={orderStatusFilter}
                  onChange={setOrderStatusFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="new">New</Option>
                  <Option value="awaiting_info">Awaiting Info</Option>
                  <Option value="in_progress">In Progress</Option>
                  <Option value="ordered">Ordered</Option>
                  <Option value="shipped">Shipped</Option>
                  <Option value="received">Received</Option>
                  <Option value="cancelled">Cancelled</Option>
                </Select>
              </Col>
              <Col xs={24} md={5}>
                <Select
                  mode="multiple"
                  placeholder="Filter by Priority"
                  value={orderPriorityFilter}
                  onChange={setOrderPriorityFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="low">Low</Option>
                  <Option value="normal">Normal</Option>
                  <Option value="high">High</Option>
                  <Option value="critical">Critical</Option>
                </Select>
              </Col>
              <Col xs={24} md={6}>
                <Select
                  mode="multiple"
                  placeholder="Filter by Type"
                  value={orderTypeFilter}
                  onChange={setOrderTypeFilter}
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

          {/* Orders Table */}
          <Card>
            <Table
              columns={orderColumns}
              dataSource={orders}
              loading={ordersLoading}
              rowKey="id"
              scroll={{ x: 1500 }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} orders`,
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No orders found"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            />
          </Card>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
              <ShoppingCartOutlined style={{ marginRight: 12 }} />
              Procurement
            </h1>
            <p style={{ margin: '4px 0 0', color: '#8c8c8c' }}>
              Process requests and manage procurement orders
            </p>
          </Col>
          <Col>
            <Space>
              <Tooltip title="Refresh data">
                <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
              </Tooltip>
              {activeTab === 'orders' && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateOrder}
                  size="large"
                >
                  Create Order
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Tabs for Requests and Orders */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </div>
  );
};
