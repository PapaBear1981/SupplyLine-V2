import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  Tag,
  Typography,
  Badge,
  Row,
  Col,
  Statistic,
  Tooltip,
  Image,
} from 'antd';
import {
  PlusOutlined,
  CheckOutlined,
  ShoppingOutlined,
  InboxOutlined,
  CloseOutlined,
  EyeOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useGetKitReordersQuery } from '../services/kitsApi';
import type {
  KitReorderRequest,
  ReorderStatus,
  ReorderPriority,
  ReorderFilters,
} from '../types';
import CreateReorderModal from './CreateReorderModal';
import ReorderDetailModal from './ReorderDetailModal';

const { Option } = Select;
const { Title, Text } = Typography;

interface KitReordersManagerProps {
  kitId: number;
}

const KitReordersManager = ({ kitId }: KitReordersManagerProps) => {
  const [filters, setFilters] = useState<ReorderFilters>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedReorderId, setSelectedReorderId] = useState<number | null>(null);

  const { data: reorders = [], isLoading } = useGetKitReordersQuery({
    kitId,
    params: filters,
  });

  // Calculate statistics
  const stats = {
    pending: reorders.filter((r) => r.status === 'pending').length,
    approved: reorders.filter((r) => r.status === 'approved').length,
    ordered: reorders.filter((r) => r.status === 'ordered').length,
    fulfilled: reorders.filter((r) => r.status === 'fulfilled').length,
    cancelled: reorders.filter((r) => r.status === 'cancelled').length,
  };

  const getStatusColor = (status: ReorderStatus) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'approved':
        return 'processing';
      case 'ordered':
        return 'blue';
      case 'fulfilled':
        return 'success';
      case 'cancelled':
        return 'error';
    }
  };

  const getPriorityColor = (priority: ReorderPriority) => {
    switch (priority) {
      case 'low':
        return 'default';
      case 'medium':
        return 'blue';
      case 'high':
        return 'orange';
      case 'urgent':
        return 'red';
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'chemical':
        return '⚗️';
      case 'expendable':
        return '📦';
      default:
        return '📦';
    }
  };

  const handleViewDetails = (reorder: KitReorderRequest) => {
    setSelectedReorderId(reorder.id);
    setDetailModalVisible(true);
  };

  const columns: ColumnsType<KitReorderRequest> = [
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 70,
      align: 'center',
      render: (type: string) => (
        <Tooltip title={type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown'}>
          <span style={{ fontSize: 20 }}>{getItemTypeIcon(type)}</span>
        </Tooltip>
      ),
      filters: [
        { text: 'Chemical', value: 'chemical' },
        { text: 'Expendable', value: 'expendable' },
      ],
      onFilter: (value, record) => record.item_type === value,
    },
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      width: 140,
      render: (partNumber: string, record: KitReorderRequest) => (
        <Space direction="vertical" size={0}>
          <Text strong>{partNumber}</Text>
          {record.is_automatic && (
            <Tag color="cyan" style={{ fontSize: 11 }}>
              AUTO
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
    },
    {
      title: 'Qty',
      dataIndex: 'quantity_requested',
      key: 'quantity_requested',
      width: 90,
      align: 'center',
      render: (quantity: number) => (
        <Badge
          count={quantity}
          showZero
          overflowCount={Infinity}
          style={{ backgroundColor: '#1890ff' }}
        />
      ),
      sorter: (a, b) => a.quantity_requested - b.quantity_requested,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      align: 'center',
      render: (priority: ReorderPriority) => (
        <Tag color={getPriorityColor(priority)}>
          {priority.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Low', value: 'low' },
        { text: 'Medium', value: 'medium' },
        { text: 'High', value: 'high' },
        { text: 'Urgent', value: 'urgent' },
      ],
      onFilter: (value, record) => record.priority === value,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status: ReorderStatus) => (
        <Tag color={getStatusColor(status)}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Requested By',
      dataIndex: 'requester_name',
      key: 'requester_name',
      width: 160,
      render: (name: string, record: KitReorderRequest) => (
        <Space direction="vertical" size={0}>
          <Text>{name || 'Unknown'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(record.requested_date).toLocaleDateString()}
          </Text>
        </Space>
      ),
      sorter: (a, b) =>
        new Date(a.requested_date).getTime() - new Date(b.requested_date).getTime(),
    },
    {
      title: 'Image',
      dataIndex: 'image_path',
      key: 'image_path',
      width: 90,
      align: 'center',
      render: (imagePath: string | null) =>
        imagePath ? (
          <Image
            src={imagePath}
            alt="Reorder item"
            width={50}
            height={50}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Links',
      key: 'links',
      width: 180,
      render: (_, record: KitReorderRequest) => (
        <Space direction="vertical" size={0}>
          {record.user_request && (
            <a
              href={`/requests/${record.user_request.id}`}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Text style={{ fontSize: 12 }}>
                Request #{record.user_request.request_number}
              </Text>
            </a>
          )}
          {record.procurement_orders && record.procurement_orders.length > 0 && (
            <Space size={4} wrap>
              {record.procurement_orders.map((order) => (
                <a
                  key={order.id}
                  href={`/orders/${order.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Text style={{ fontSize: 12 }}>
                    PO #{order.order_number}
                  </Text>
                </a>
              ))}
            </Space>
          )}
          {!record.user_request && !record.procurement_orders?.length && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              -
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center',
      fixed: 'right',
      render: (_, record: KitReorderRequest) => (
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
    <>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Statistics Cards */}
        <Row gutter={16}>
          <Col span={4}>
            <Card>
              <Statistic
                title="Pending"
                value={stats.pending}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#8c8c8c' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Approved"
                value={stats.approved}
                prefix={<CheckOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Ordered"
                value={stats.ordered}
                prefix={<ShoppingOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Fulfilled"
                value={stats.fulfilled}
                prefix={<InboxOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Cancelled"
                value={stats.cancelled}
                prefix={<CloseOutlined />}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="Total"
                value={reorders.length}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Main Table */}
        <Card
          title={
            <Space>
              <Title level={4} style={{ margin: 0 }}>
                Reorder Requests
              </Title>
              <Badge count={reorders.length} showZero />
            </Space>
          }
          extra={
            <Space>
              <Select
                placeholder="Filter by status"
                style={{ width: 150 }}
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                allowClear
              >
                <Option value="pending">Pending</Option>
                <Option value="approved">Approved</Option>
                <Option value="ordered">Ordered</Option>
                <Option value="fulfilled">Fulfilled</Option>
                <Option value="cancelled">Cancelled</Option>
              </Select>
              <Select
                placeholder="Filter by priority"
                style={{ width: 150 }}
                value={filters.priority}
                onChange={(value) => setFilters({ ...filters, priority: value })}
                allowClear
              >
                <Option value="low">Low</Option>
                <Option value="medium">Medium</Option>
                <Option value="high">High</Option>
                <Option value="urgent">Urgent</Option>
              </Select>
              <Select
                placeholder="Filter by type"
                style={{ width: 150 }}
                value={filters.is_automatic}
                onChange={(value) => setFilters({ ...filters, is_automatic: value })}
                allowClear
              >
                <Option value={true}>Automatic</Option>
                <Option value={false}>Manual</Option>
              </Select>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                Create Reorder
              </Button>
            </Space>
          }
        >
          <Table
            columns={columns}
            dataSource={reorders}
            rowKey="id"
            loading={isLoading}
            onRow={(record) => ({
              onClick: () => handleViewDetails(record),
              style: { cursor: 'pointer' },
            })}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} reorder${total !== 1 ? 's' : ''}`,
            }}
            scroll={{ x: 1280 }}
          />
        </Card>
      </Space>

      <CreateReorderModal
        visible={createModalVisible}
        kitId={kitId}
        onClose={() => setCreateModalVisible(false)}
      />

      {selectedReorderId && (
        <ReorderDetailModal
          open={detailModalVisible}
          reorderId={selectedReorderId}
          onClose={() => {
            setDetailModalVisible(false);
            setSelectedReorderId(null);
          }}
        />
      )}
    </>
  );
};

export default KitReordersManager;
