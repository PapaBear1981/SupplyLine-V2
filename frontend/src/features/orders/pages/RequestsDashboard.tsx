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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetRequestsQuery, useGetRequestAnalyticsQuery } from '../services/requestsApi';
import { StatusBadge, PriorityBadge, MobileRequestsList, RequestDetailModal } from '../components';
import { useIsMobile } from '@shared/hooks/useMobile';
import type { UserRequest, RequestStatus, RequestPriority } from '../types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

export const RequestsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  const queryParams = {
    search: searchQuery || undefined,
    status: statusFilter.length > 0 ? statusFilter.join(',') : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter.join(',') : undefined,
  };

  const { data: requests = [], isLoading, refetch } = useGetRequestsQuery(queryParams);
  const { data: analytics } = useGetRequestAnalyticsQuery();

  // Render mobile version if on mobile device
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
      width: 300,
      ellipsis: true,
      render: (title: string, record: UserRequest) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{title}</span>
          <Badge count={record.item_count || 0} showZero style={{ fontSize: 11 }} />
        </Space>
      ),
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
      render: (requester: { first_name: string; last_name: string } | undefined) =>
        requester ? `${requester.first_name} ${requester.last_name}` : '-',
    },
    {
      title: 'Items',
      dataIndex: 'item_count',
      key: 'item_count',
      width: 80,
      render: (count: number) => <Badge count={count || 0} showZero />,
    },
    {
      title: 'Due Date',
      dataIndex: 'expected_due_date',
      key: 'expected_due_date',
      width: 140,
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
      width: 120,
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
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
              <FileTextOutlined style={{ marginRight: 12 }} />
              User Requests
            </h1>
            <p style={{ margin: '4px 0 0', color: '#8c8c8c' }}>
              Manage multi-item procurement requests
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
              >
                Create Request
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
                title="Total Items"
                value={analytics.total_items}
                prefix={<FileTextOutlined style={{ color: '#52c41a' }} />}
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
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={10}>
            <Input
              placeholder="Search requests..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              mode="multiple"
              placeholder="Filter by Status"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              allowClear
            >
              <Select.Option value="new">New</Select.Option>
              <Select.Option value="in_progress">In Progress</Select.Option>
              <Select.Option value="partially_ordered">Partially Ordered</Select.Option>
              <Select.Option value="ordered">Ordered</Select.Option>
              <Select.Option value="partially_received">Partially Received</Select.Option>
              <Select.Option value="received">Received</Select.Option>
            </Select>
          </Col>
          <Col xs={24} md={7}>
            <Select
              mode="multiple"
              placeholder="Filter by Priority"
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: '100%' }}
              allowClear
            >
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="normal">Normal</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="critical">Critical</Select.Option>
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
          scroll={{ x: 1300 }}
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
