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
  FileTextOutlined,
  ToolOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetRequestsQuery, useGetRequestAnalyticsQuery } from '../services/requestsApi';
import { StatusBadge, PriorityBadge, MobileOrdersList } from '../components';
import { useIsMobile } from '@shared/hooks/useMobile';
import type {
  UserRequest,
  RequestStatus,
  RequestPriority,
  RequestType,
} from '../types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const { Option } = Select;

const ACTIVE_REQUEST_STATUSES: RequestStatus[] = [
  'new',
  'under_review',
  'pending_fulfillment',
  'in_transfer',
  'awaiting_external_procurement',
  'partially_fulfilled',
  'needs_info',
  'awaiting_info',
  'in_progress',
  'partially_ordered',
  'ordered',
  'partially_received',
];

const HISTORY_REQUEST_STATUSES: RequestStatus[] = ['fulfilled', 'cancelled', 'received'];

const REQUEST_TYPE_LABELS: Record<string, string> = {
  manual: 'Manual',
  kit_replenishment: 'Kit Replenishment',
  warehouse_replenishment: 'Warehouse Replenishment',
  transfer: 'Transfer',
  repairable_return: 'Repairable Return',
};

export const OrdersDashboard: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const [requestSearchQuery, setRequestSearchQuery] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatus[]>([]);
  const [requestPriorityFilter, setRequestPriorityFilter] = useState<RequestPriority[]>([]);
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestType[]>([]);

  const allowedStatuses = activeTab === 'history' ? HISTORY_REQUEST_STATUSES : ACTIVE_REQUEST_STATUSES;
  const effectiveStatuses = requestStatusFilter.length > 0
    ? requestStatusFilter.filter((s) => allowedStatuses.includes(s))
    : allowedStatuses;

  const requestQueryParams = {
    search: requestSearchQuery || undefined,
    status: effectiveStatuses.join(','),
    priority: requestPriorityFilter.length > 0 ? requestPriorityFilter.join(',') : undefined,
    request_type: requestTypeFilter.length > 0 ? requestTypeFilter.join(',') : undefined,
  };

  const {
    data: requests = [],
    isLoading: requestsLoading,
    refetch: refetchRequests,
  } = useGetRequestsQuery(requestQueryParams);
  const { data: requestAnalytics } = useGetRequestAnalyticsQuery();

  // Pending requests that need fulfillment action (drives the Active tab badge).
  const pendingRequestsCount =
    (requestAnalytics?.status_breakdown?.new || 0) +
    (requestAnalytics?.status_breakdown?.under_review || 0) +
    (requestAnalytics?.status_breakdown?.pending_fulfillment || 0) +
    (requestAnalytics?.status_breakdown?.in_progress || 0) +
    (requestAnalytics?.status_breakdown?.awaiting_info || 0);

  if (isMobile) {
    return <MobileOrdersList />;
  }

  const handleViewRequest = (requestId: number) => navigate(`/requests/${requestId}`);

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
      title: 'Buyer',
      dataIndex: 'buyer_name',
      key: 'buyer_name',
      width: 130,
      ellipsis: true,
      render: (name: string) => name || <Tag>Unassigned</Tag>,
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
          {activeTab === 'history' ? 'View' : 'Process'}
        </Button>
      ),
    },
  ];

  const statusOptions = activeTab === 'history'
    ? [
        { value: 'fulfilled', label: 'Fulfilled' },
        { value: 'cancelled', label: 'Cancelled' },
      ]
    : [
        { value: 'new', label: 'New' },
        { value: 'under_review', label: 'Under Review' },
        { value: 'pending_fulfillment', label: 'Pending Fulfillment' },
        { value: 'in_transfer', label: 'In Transfer' },
        { value: 'awaiting_external_procurement', label: 'Awaiting Procurement' },
        { value: 'partially_fulfilled', label: 'Partially Fulfilled' },
        { value: 'needs_info', label: 'Needs Info' },
      ];

  const requestsTable = (
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
                value={pendingRequestsCount}
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
              placeholder={
                activeTab === 'history'
                  ? 'Search request history...'
                  : 'Search active requests...'
              }
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
              options={statusOptions}
            />
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
          scroll={{ x: 1600 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) =>
              activeTab === 'history'
                ? `${total} historical request${total === 1 ? '' : 's'}`
                : `${total} active request${total === 1 ? '' : 's'}`,
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  activeTab === 'history' ? 'No historical requests' : 'No active requests'
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>
    </>
  );

  const tabItems = [
    {
      key: 'active',
      label: (
        <span>
          <FileTextOutlined />
          Active Requests
          {pendingRequestsCount > 0 && (
            <Badge count={pendingRequestsCount} style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
      children: requestsTable,
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined />
          History
        </span>
      ),
      children: requestsTable,
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
              Review incoming requests and drive them to fulfillment
            </p>
          </Col>
          <Col>
            <Space>
              <Tooltip title="Refresh data">
                <Button icon={<ReloadOutlined />} onClick={() => refetchRequests()} />
              </Tooltip>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/requests/new')}
                size="large"
                data-testid="requests-create-button"
              >
                New Request
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as 'active' | 'history');
          setRequestStatusFilter([]);
        }}
        items={tabItems}
        size="large"
      />
    </div>
  );
};
