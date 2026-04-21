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
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetOrdersQuery, useGetOrderAnalyticsQuery } from '../services/ordersApi';
import { useGetRequestsQuery, useGetRequestAnalyticsQuery } from '../services/requestsApi';
import { StatusBadge, PriorityBadge, ItemTypeBadge, MobileOrdersList } from '../components';
import { useIsMobile } from '@shared/hooks/useMobile';
import type {
  ProcurementOrder,
  OrderStatus,
  OrderPriority,
  OrderType,
  UserRequest,
  RequestStatus,
  RequestPriority,
  RequestType,
  FulfillmentActionType,
} from '../types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const { Option } = Select;

const REQUEST_TYPE_LABELS: Record<string, string> = {
  manual: 'Manual',
  kit_replenishment: 'Kit Replenishment',
  warehouse_replenishment: 'Warehouse Replenishment',
  transfer: 'Transfer',
  repairable_return: 'Repairable Return',
};

const FULFILLMENT_ACTION_TYPE_LABELS: Record<string, string> = {
  stock_fulfillment: 'Stock Fulfillment',
  transfer: 'Transfer',
  kit_replenishment: 'Kit Replenishment',
  external_procurement: 'External Procurement',
  return_tracking: 'Return Tracking',
};

export const OrdersDashboard: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestType[]>([]);

  const orderQueryParams = {
    search: orderSearchQuery || undefined,
    status: orderStatusFilter.length > 0 ? orderStatusFilter.join(',') : undefined,
    priority: orderPriorityFilter.length > 0 ? orderPriorityFilter.join(',') : undefined,
    order_type: orderTypeFilter.length > 0 ? orderTypeFilter.join(',') : undefined,
  };

  const requestQueryParams = {
    search: requestSearchQuery || undefined,
    status: requestStatusFilter.length > 0 ? requestStatusFilter.join(',') : undefined,
    priority: requestPriorityFilter.length > 0 ? requestPriorityFilter.join(',') : undefined,
    request_type: requestTypeFilter.length > 0 ? requestTypeFilter.join(',') : undefined,
  };

  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useGetOrdersQuery(orderQueryParams);
  const { data: orderAnalytics } = useGetOrderAnalyticsQuery();
  const { data: requests = [], isLoading: requestsLoading, refetch: refetchRequests } = useGetRequestsQuery(requestQueryParams);
  const { data: requestAnalytics } = useGetRequestAnalyticsQuery();

  // Pending requests that need fulfillment action
  const pendingRequestsCount = requests.filter(
    (r) => ['new', 'under_review', 'pending_fulfillment', 'in_progress', 'awaiting_info'].includes(r.status)
  ).length;

  if (isMobile) {
    return <MobileOrdersList />;
  }

  const handleCreateOrder = () => navigate('/orders/new');
  const handleViewOrder = (orderId: number) => navigate(`/orders/${orderId}`);
  const handleViewRequest = (requestId: number) => navigate(`/requests/${requestId}`);

  const handleRefresh = () => {
    if (activeTab === 'orders') refetchOrders();
    else refetchRequests();
  };

  // Requests columns — summarized demand view for mechanics / fulfillment intake
  const requestColumns: ColumnsType<UserRequest> = [
    {
      title: 'Request #',
      dataIndex: 'request_number',
      key: 'request_number',
      fixed: 'left',
      width: 120,
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
      width: 220,
      ellipsis: true,
      render: (title: string, record: UserRequest) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{title}</span>
          {record.repairable && (
            <Tag color="purple" icon={<ToolOutlined />} style={{ fontSize: 11 }}>
              Repairable
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'request_type',
      key: 'request_type',
      width: 150,
      render: (type: RequestType) => (
        <Tag color={type === 'repairable_return' ? 'purple' : type === 'kit_replenishment' ? 'blue' : 'default'}>
          {REQUEST_TYPE_LABELS[type] || 'Manual'}
        </Tag>
      ),
    },
    {
      title: 'Items',
      dataIndex: 'item_count',
      key: 'item_count',
      width: 70,
      render: (count: number) => <Badge count={count || 0} showZero style={{ backgroundColor: '#1890ff' }} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (status: RequestStatus) => <StatusBadge status={status} type="request" />,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (priority: RequestPriority) => <PriorityBadge priority={priority} />,
    },
    {
      title: 'Destination',
      key: 'destination',
      width: 150,
      ellipsis: true,
      render: (_: unknown, record: UserRequest) =>
        record.destination_location || (record.destination_type?.replace(/_/g, ' ')) || '-',
    },
    {
      title: 'Requester',
      dataIndex: 'requester_name',
      key: 'requester_name',
      width: 130,
      ellipsis: true,
      render: (name: string) => name || '-',
    },
    {
      title: 'Core Return',
      dataIndex: 'return_status',
      key: 'return_status',
      width: 130,
      render: (_: unknown, record: UserRequest) => {
        if (!record.repairable && !record.return_status) return '-';
        const rs = record.return_status;
        if (!rs && record.repairable) return <Tag color="orange">Core Expected</Tag>;
        const labels: Record<string, string> = {
          issued_core_expected: 'Core Expected',
          in_return_transit: 'In Transit',
          returned_to_stores: 'Returned',
          closed: 'Closed',
        };
        const colors: Record<string, string> = {
          issued_core_expected: 'orange',
          in_return_transit: 'blue',
          returned_to_stores: 'green',
          closed: 'default',
        };
        return rs ? <Tag color={colors[rs] || 'default'}>{labels[rs] || rs}</Tag> : '-';
      },
    },
    {
      title: 'Due Date',
      dataIndex: 'expected_due_date',
      key: 'expected_due_date',
      width: 120,
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
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 90,
      render: (_, record: UserRequest) => (
        <Button type="primary" size="small" onClick={() => handleViewRequest(record.id)}>
          Process
        </Button>
      ),
    },
  ];

  // Fulfillment Queue columns — detailed work queue for buyers / materials staff
  const orderColumns: ColumnsType<ProcurementOrder> = [
    {
      title: 'Order #',
      dataIndex: 'order_number',
      key: 'order_number',
      fixed: 'left',
      width: 110,
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
      width: 220,
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
      title: 'Linked Request',
      dataIndex: 'request_id',
      key: 'request_id',
      width: 120,
      render: (requestId: number) =>
        requestId ? (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/requests/${requestId}`)}>
            View Request
          </Button>
        ) : (
          <Tag>Standalone</Tag>
        ),
    },
    {
      title: 'Action Type',
      dataIndex: 'fulfillment_action_type',
      key: 'fulfillment_action_type',
      width: 150,
      render: (type: FulfillmentActionType) => {
        if (!type) return <Tag>General</Tag>;
        const colors: Record<string, string> = {
          stock_fulfillment: 'green',
          transfer: 'geekblue',
          kit_replenishment: 'blue',
          external_procurement: 'orange',
          return_tracking: 'purple',
        };
        return <Tag color={colors[type] || 'default'}>{FULFILLMENT_ACTION_TYPE_LABELS[type] || type}</Tag>;
      },
    },
    {
      title: 'Source',
      dataIndex: 'source_location',
      key: 'source_location',
      width: 150,
      ellipsis: true,
      render: (loc: string) => loc || '-',
    },
    {
      title: 'Type',
      dataIndex: 'order_type',
      key: 'order_type',
      width: 110,
      render: (type: OrderType) => type && <ItemTypeBadge type={type} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: OrderStatus) => <StatusBadge status={status} type="order" />,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (priority: OrderPriority) => <PriorityBadge priority={priority} />,
    },
    {
      title: 'Qty Fulfilled',
      key: 'fulfillment_quantity',
      width: 100,
      render: (_: unknown, record: ProcurementOrder) => {
        if (record.fulfillment_quantity != null) {
          return `${record.fulfillment_quantity} / ${record.quantity || '?'}`;
        }
        return record.quantity ? `${record.quantity} ${record.unit || ''}` : '-';
      },
    },
    {
      title: 'Requester',
      dataIndex: 'requester_name',
      key: 'requester_name',
      width: 130,
      ellipsis: true,
      render: (name: string) => name || '-',
    },
    {
      title: 'Buyer',
      dataIndex: 'buyer_name',
      key: 'buyer_name',
      width: 130,
      ellipsis: true,
      render: (name: string) => name || <Tag>Unassigned</Tag>,
    },
    {
      title: 'Due Date',
      dataIndex: 'expected_due_date',
      key: 'expected_due_date',
      width: 130,
      render: (dueDate: string, record: ProcurementOrder) => {
        if (!dueDate) return '-';
        return (
          <Space direction="vertical" size={0}>
            <span style={{ color: record.is_late ? '#ff4d4f' : undefined }}>
              {dayjs(dueDate).format('MMM D, YYYY')}
            </span>
            <span style={{ fontSize: 12, color: record.is_late ? '#ff4d4f' : '#8c8c8c' }}>
              {dayjs(dueDate).fromNow()}
            </span>
            {record.is_late && <Tag color="red">Overdue</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 80,
      render: (_, record: ProcurementOrder) => (
        <Button size="small" onClick={() => handleViewOrder(record.id)}>
          View
        </Button>
      ),
    },
  ];

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
                    title="Pending Fulfillment"
                    value={
                      (requestAnalytics.status_breakdown?.new || 0) +
                      (requestAnalytics.status_breakdown?.under_review || 0) +
                      (requestAnalytics.status_breakdown?.pending_fulfillment || 0) +
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
                    title="Fulfilled"
                    value={
                      (requestAnalytics.status_breakdown?.fulfilled || 0) +
                      (requestAnalytics.status_breakdown?.received || 0)
                    }
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={7}>
                <Input
                  placeholder="Search by request number, title..."
                  prefix={<SearchOutlined />}
                  value={requestSearchQuery}
                  onChange={(e) => setRequestSearchQuery(e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={24} md={6}>
                <Select
                  mode="multiple"
                  placeholder="Filter by Status"
                  value={requestStatusFilter}
                  onChange={setRequestStatusFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="new">New</Option>
                  <Option value="under_review">Under Review</Option>
                  <Option value="pending_fulfillment">Pending Fulfillment</Option>
                  <Option value="in_transfer">In Transfer</Option>
                  <Option value="awaiting_external_procurement">Awaiting Procurement</Option>
                  <Option value="partially_fulfilled">Partially Fulfilled</Option>
                  <Option value="fulfilled">Fulfilled</Option>
                  <Option value="needs_info">Needs Info</Option>
                  <Option value="cancelled">Cancelled</Option>
                </Select>
              </Col>
              <Col xs={24} md={5}>
                <Select
                  mode="multiple"
                  placeholder="Filter by Priority"
                  value={requestPriorityFilter}
                  onChange={setRequestPriorityFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="routine">Routine</Option>
                  <Option value="urgent">Urgent</Option>
                  <Option value="aog">AOG</Option>
                </Select>
              </Col>
              <Col xs={24} md={6}>
                <Select
                  mode="multiple"
                  placeholder="Filter by Type"
                  value={requestTypeFilter}
                  onChange={setRequestTypeFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="manual">Manual</Option>
                  <Option value="kit_replenishment">Kit Replenishment</Option>
                  <Option value="warehouse_replenishment">Warehouse Replenishment</Option>
                  <Option value="transfer">Transfer</Option>
                  <Option value="repairable_return">Repairable Return</Option>
                </Select>
              </Col>
            </Row>
          </Card>

          <Card>
            <Table
              columns={requestColumns}
              dataSource={requests}
              loading={requestsLoading}
              rowKey="id"
              scroll={{ x: 1500 }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} requests`,
              }}
              locale={{
                emptyText: (
                  <Empty description="No requests found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
          Fulfillment Queue
        </span>
      ),
      children: (
        <>
          {orderAnalytics && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Actions"
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
                      (orderAnalytics.status_breakdown?.sourcing || 0) +
                      (orderAnalytics.status_breakdown?.in_transfer || 0) +
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
                    title="Fulfilled"
                    value={
                      (orderAnalytics.status_breakdown?.fulfilled || 0) +
                      (orderAnalytics.status_breakdown?.received || 0)
                    }
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={7}>
                <Input
                  placeholder="Search fulfillment queue..."
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
                  <Option value="in_progress">Sourcing</Option>
                  <Option value="ordered">In Transfer</Option>
                  <Option value="awaiting_info">Awaiting Info</Option>
                  <Option value="shipped">Shipped</Option>
                  <Option value="received">Fulfilled</Option>
                  <Option value="cancelled">Cancelled</Option>
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  mode="multiple"
                  placeholder="Priority"
                  value={orderPriorityFilter}
                  onChange={setOrderPriorityFilter}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="low">Routine</Option>
                  <Option value="normal">Normal</Option>
                  <Option value="high">Urgent</Option>
                  <Option value="critical">AOG</Option>
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  mode="multiple"
                  placeholder="Type"
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

          <Card>
            <Table
              columns={orderColumns}
              dataSource={orders}
              loading={ordersLoading}
              rowKey="id"
              scroll={{ x: 1700 }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} fulfillment actions`,
              }}
              locale={{
                emptyText: (
                  <Empty description="No fulfillment actions found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ),
              }}
            />
          </Card>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }} data-testid="orders-page">
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
              <ShoppingCartOutlined style={{ marginRight: 12 }} />
              Fulfillment
            </h1>
            <p style={{ margin: '4px 0 0', color: '#8c8c8c' }}>
              Review incoming requests and manage fulfillment actions
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
                  data-testid="orders-create-button"
                >
                  New Fulfillment Action
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </div>
  );
};
