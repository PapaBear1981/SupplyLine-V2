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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetOrdersQuery, useGetOrderAnalyticsQuery } from '../services/ordersApi';
import { StatusBadge, PriorityBadge, ItemTypeBadge, MobileOrdersList } from '../components';
import { useIsMobile } from '@shared/hooks/useMobile';
import type { ProcurementOrder, OrderStatus, OrderPriority, OrderType } from '../types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const { Option } = Select;

export const OrdersDashboard: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<OrderPriority[]>([]);
  const [typeFilter, setTypeFilter] = useState<OrderType[]>([]);

  // Build query params
  const queryParams = {
    search: searchQuery || undefined,
    status: statusFilter.length > 0 ? statusFilter.join(',') : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter.join(',') : undefined,
    order_type: typeFilter.length > 0 ? typeFilter.join(',') : undefined,
  };

  const { data: orders = [], isLoading, refetch } = useGetOrdersQuery(queryParams);
  const { data: analytics } = useGetOrderAnalyticsQuery();

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileOrdersList />;
  }

  const handleCreateOrder = () => {
    navigate('/orders/new');
  };

  const handleViewOrder = (orderId: number) => {
    navigate(`/orders/${orderId}`);
  };

  const columns: ColumnsType<ProcurementOrder> = [
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

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
              <ShoppingCartOutlined style={{ marginRight: 12 }} />
              Procurement Orders
            </h1>
            <p style={{ margin: '4px 0 0', color: '#8c8c8c' }}>
              Manage and track all procurement orders
            </p>
          </Col>
          <Col>
            <Space>
              <Tooltip title="Refresh data">
                <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
              </Tooltip>
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

      {/* Analytics Cards */}
      {analytics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Orders"
                value={analytics.total_count}
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
                  (analytics.status_breakdown?.new || 0) +
                  (analytics.status_breakdown?.in_progress || 0) +
                  (analytics.status_breakdown?.ordered || 0) +
                  (analytics.status_breakdown?.shipped || 0)
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
                value={analytics.late_count}
                prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                valueStyle={{ color: analytics.late_count > 0 ? '#ff4d4f' : undefined }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Completed"
                value={analytics.status_breakdown?.received || 0}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters and Search */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search orders..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              mode="multiple"
              placeholder="Filter by Status"
              value={statusFilter}
              onChange={setStatusFilter}
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
          <Col xs={24} md={6}>
            <Select
              mode="multiple"
              placeholder="Filter by Type"
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

      {/* Orders Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          loading={isLoading}
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
    </div>
  );
};
