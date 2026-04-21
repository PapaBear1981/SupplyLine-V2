import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Space,
  Button,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Empty,
  Badge,
  Tag,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  EyeOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetRequestsQuery, useGetRequestAnalyticsQuery } from '../services/requestsApi';
import { StatusBadge, PriorityBadge, MobileRequestsList, RequestDetailModal } from '../components';
import { useIsMobile } from '@shared/hooks/useMobile';
import type { UserRequest, RequestStatus, RequestPriority, RequestType } from '../types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const REQUEST_TYPE_LABELS: Record<string, string> = {
  manual: 'Manual',
  kit_replenishment: 'Kit Replenishment',
  warehouse_replenishment: 'Warehouse Replenishment',
  transfer: 'Transfer',
  repairable_return: 'Repairable Return',
};

const REQUEST_TYPE_COLORS: Record<string, string> = {
  manual: 'default',
  kit_replenishment: 'blue',
  warehouse_replenishment: 'cyan',
  transfer: 'geekblue',
  repairable_return: 'purple',
};

export const RequestsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority[]>([]);
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestType[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  const queryParams = {
    search: searchQuery || undefined,
    status: statusFilter.length > 0 ? statusFilter.join(',') : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter.join(',') : undefined,
    request_type: requestTypeFilter.length > 0 ? requestTypeFilter.join(',') : undefined,
  };

  const { data: requests = [], isLoading, refetch } = useGetRequestsQuery(queryParams);
  const { data: analytics } = useGetRequestAnalyticsQuery();

  if (isMobile) {
    return <MobileRequestsList />;
  }

  const handleViewDetails = (request: UserRequest) => {
    setSelectedRequestId(request.id);
    setDetailModalVisible(true);
  };

  const columns: ColumnsType<UserRequest> = [
    {
      title: 'Request #',
      dataIndex: 'request_number',
      key: 'request_number',
      fixed: 'left',
      width: 120,
      render: (requestNumber: string, record: UserRequest) => (
        <Button
          type="link"
          onClick={(e) => {
            e.stopPropagation();
            handleViewDetails(record);
          }}
          style={{ padding: 0, fontWeight: 600 }}
        >
          {requestNumber}
        </Button>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 260,
      ellipsis: true,
      render: (title: string, record: UserRequest) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{title}</span>
          <Space size={4}>
            <Badge count={record.item_count || 0} showZero style={{ fontSize: 11 }} />
            {record.repairable && (
              <Tooltip title="Repairable item — core return may be required">
                <Tag color="purple" icon={<ToolOutlined />} style={{ fontSize: 11, margin: 0 }}>
                  Repairable
                </Tag>
              </Tooltip>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'request_type',
      key: 'request_type',
      width: 160,
      render: (type: RequestType) => {
        const label = REQUEST_TYPE_LABELS[type] || type || 'Manual';
        const color = REQUEST_TYPE_COLORS[type] || 'default';
        return <Tag color={color}>{label}</Tag>;
      },
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
      width: 100,
      render: (priority: RequestPriority) => <PriorityBadge priority={priority} />,
    },
    {
      title: 'Destination',
      dataIndex: 'destination_location',
      key: 'destination_location',
      width: 160,
      ellipsis: true,
      render: (loc: string, record: UserRequest) =>
        loc || (record.destination_type ? record.destination_type.replace(/_/g, ' ') : '-'),
    },
    {
      title: 'Requester',
      dataIndex: 'requester_name',
      key: 'requester_name',
      width: 140,
      ellipsis: true,
      render: (name: string) => name || '-',
    },
    {
      title: 'Core Return',
      dataIndex: 'return_status',
      key: 'return_status',
      width: 140,
      render: (_: unknown, record: UserRequest) => {
        if (!record.repairable && !record.return_status) return '-';
        if (record.return_status) {
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
          return (
            <Tag color={colors[record.return_status] || 'default'}>
              {labels[record.return_status] || record.return_status}
            </Tag>
          );
        }
        return record.repairable ? <Tag color="orange">Core Expected</Tag> : '-';
      },
    },
    {
      title: 'Due Date',
      dataIndex: 'expected_due_date',
      key: 'expected_due_date',
      width: 130,
      render: (dueDate: string, record: UserRequest) =>
        dueDate ? (
          <Space direction="vertical" size={0}>
            <span style={{ color: record.is_late ? '#ff4d4f' : undefined }}>
              {dayjs(dueDate).format('MMM D, YYYY')}
            </span>
            {record.is_late && <Badge status="error" text="Overdue" />}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 110,
      render: (createdAt: string) => dayjs(createdAt).format('MMM D, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 80,
      align: 'center',
      render: (_, record: UserRequest) => (
        <Tooltip title="View Details">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails(record);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }} data-testid="requests-page">
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
              <FileTextOutlined style={{ marginRight: 12 }} />
              Requests
            </h1>
            <p style={{ margin: '4px 0 0', color: '#8c8c8c' }}>
              Operational demand — track status of your requests
            </p>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
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

      {analytics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Requests"
                value={analytics.total_count}
                prefix={<InboxOutlined style={{ color: '#1890ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Active"
                value={
                  (analytics.status_breakdown?.new || 0) +
                  (analytics.status_breakdown?.pending_fulfillment || 0) +
                  (analytics.status_breakdown?.under_review || 0) +
                  (analytics.status_breakdown?.in_transfer || 0) +
                  (analytics.status_breakdown?.in_progress || 0)
                }
                prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
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
                title="Fulfilled"
                value={
                  (analytics.status_breakdown?.fulfilled || 0) +
                  (analytics.status_breakdown?.received || 0)
                }
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search requests..."
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
              <Select.Option value="new">New</Select.Option>
              <Select.Option value="under_review">Under Review</Select.Option>
              <Select.Option value="pending_fulfillment">Pending Fulfillment</Select.Option>
              <Select.Option value="in_transfer">In Transfer</Select.Option>
              <Select.Option value="awaiting_external_procurement">Awaiting Procurement</Select.Option>
              <Select.Option value="partially_fulfilled">Partially Fulfilled</Select.Option>
              <Select.Option value="fulfilled">Fulfilled</Select.Option>
              <Select.Option value="needs_info">Needs Info</Select.Option>
              <Select.Option value="cancelled">Cancelled</Select.Option>
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
              <Select.Option value="routine">Routine</Select.Option>
              <Select.Option value="urgent">Urgent</Select.Option>
              <Select.Option value="aog">AOG</Select.Option>
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
              <Select.Option value="manual">Manual</Select.Option>
              <Select.Option value="kit_replenishment">Kit Replenishment</Select.Option>
              <Select.Option value="warehouse_replenishment">Warehouse Replenishment</Select.Option>
              <Select.Option value="transfer">Transfer</Select.Option>
              <Select.Option value="repairable_return">Repairable Return</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={requests}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: 1500 }}
          onRow={(record) => ({
            onClick: () => handleViewDetails(record),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} requests`,
          }}
          locale={{
            emptyText: <Empty description="No requests found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>

      {selectedRequestId && (
        <RequestDetailModal
          open={detailModalVisible}
          requestId={selectedRequestId}
          onClose={() => {
            setDetailModalVisible(false);
            setSelectedRequestId(null);
          }}
        />
      )}
    </div>
  );
};
