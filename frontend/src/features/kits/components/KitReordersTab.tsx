import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Select,
  Row,
  Col,
  Tooltip,
  Badge,
  Empty,
  Dropdown,
  message,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  MoreOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  useGetKitReordersQuery,
  useApproveKitReorderMutation,
  useCancelKitReorderMutation,
} from '../../orders/services/kitReordersApi';
import type { KitReorderRequest, KitReorderStatus, KitReorderPriority } from '../../orders/types';
import CreateReorderModal from './CreateReorderModal';
import ReorderDetailModal from './ReorderDetailModal';
import MarkOrderedModal from './MarkOrderedModal';
import FulfillReorderModal from './FulfillReorderModal';

const { Title, Text } = Typography;

interface KitReordersTabProps {
  kitId: number;
  kitName: string;
}

const KitReordersTab = ({ kitId, kitName }: KitReordersTabProps) => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>(undefined);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [markOrderedModalOpen, setMarkOrderedModalOpen] = useState(false);
  const [fulfillModalOpen, setFulfillModalOpen] = useState(false);
  const [selectedReorder, setSelectedReorder] = useState<KitReorderRequest | null>(null);

  const { data: reorders = [], isLoading, refetch } = useGetKitReordersQuery({
    kit_id: kitId,
    status: statusFilter,
    priority: priorityFilter,
  });

  const [approveReorder, { isLoading: isApproving }] = useApproveKitReorderMutation();
  const [cancelReorder, { isLoading: isCancelling }] = useCancelKitReorderMutation();

  const getStatusColor = (status: KitReorderStatus) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'approved':
        return 'processing';
      case 'ordered':
        return 'blue';
      case 'fulfilled':
        return 'success';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: KitReorderPriority) => {
    switch (priority) {
      case 'low':
        return 'default';
      case 'medium':
        return 'blue';
      case 'high':
        return 'orange';
      case 'urgent':
        return 'red';
      default:
        return 'default';
    }
  };

  const handleApprove = async (reorder: KitReorderRequest) => {
    Modal.confirm({
      title: 'Approve Reorder Request',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Are you sure you want to approve this reorder request?</p>
          <p><strong>Part:</strong> {reorder.part_number}</p>
          <p><strong>Quantity:</strong> {reorder.quantity_requested}</p>
          <p>This will create a procurement order and mark the reorder as "ordered".</p>
        </div>
      ),
      okText: 'Approve & Create Order',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await approveReorder(reorder.id).unwrap();
          message.success('Reorder approved and procurement order created');
          refetch();
        } catch (error: unknown) {
          const err = error as { data?: { error?: string } };
          message.error(err.data?.error || 'Failed to approve reorder');
        }
      },
    });
  };

  const handleCancel = async (reorder: KitReorderRequest) => {
    Modal.confirm({
      title: 'Cancel Reorder Request',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to cancel this reorder request for "${reorder.part_number}"?`,
      okText: 'Cancel Request',
      okType: 'danger',
      cancelText: 'Keep Request',
      onOk: async () => {
        try {
          await cancelReorder({ reorderId: reorder.id }).unwrap();
          message.success('Reorder request cancelled');
          refetch();
        } catch (error: unknown) {
          const err = error as { data?: { error?: string } };
          message.error(err.data?.error || 'Failed to cancel reorder');
        }
      },
    });
  };

  const handleViewDetails = (reorder: KitReorderRequest) => {
    setSelectedReorder(reorder);
    setDetailModalOpen(true);
  };

  const handleMarkOrdered = (reorder: KitReorderRequest) => {
    setSelectedReorder(reorder);
    setMarkOrderedModalOpen(true);
  };

  const handleFulfill = (reorder: KitReorderRequest) => {
    setSelectedReorder(reorder);
    setFulfillModalOpen(true);
  };

  const navigateToRequests = () => {
    navigate('/orders?tab=requests');
  };

  const getActionMenu = (reorder: KitReorderRequest): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      {
        key: 'view',
        icon: <EyeOutlined />,
        label: 'View Details',
        onClick: () => handleViewDetails(reorder),
      },
    ];

    if (reorder.status === 'pending') {
      items.push(
        {
          key: 'approve',
          icon: <CheckCircleOutlined />,
          label: 'Approve & Create Order',
          onClick: () => handleApprove(reorder),
        },
        {
          key: 'markOrdered',
          icon: <ShoppingCartOutlined />,
          label: 'Mark as Ordered',
          onClick: () => handleMarkOrdered(reorder),
        },
        {
          type: 'divider',
        },
        {
          key: 'cancel',
          icon: <CloseCircleOutlined />,
          label: 'Cancel Request',
          danger: true,
          onClick: () => handleCancel(reorder),
        }
      );
    }

    if (reorder.status === 'approved') {
      items.push({
        key: 'markOrdered',
        icon: <ShoppingCartOutlined />,
        label: 'Mark as Ordered',
        onClick: () => handleMarkOrdered(reorder),
      });
    }

    if (reorder.status === 'ordered') {
      items.push({
        key: 'fulfill',
        icon: <CheckCircleOutlined />,
        label: 'Fulfill Order',
        onClick: () => handleFulfill(reorder),
      });
    }

    return items;
  };

  const columns: ColumnsType<KitReorderRequest> = [
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      render: (partNumber: string, record: KitReorderRequest) => (
        <Space direction="vertical" size={0}>
          <Text strong>{partNumber}</Text>
          {record.is_automatic && (
            <Tag color="geekblue" style={{ fontSize: 10 }}>AUTO</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 200,
    },
    {
      title: 'Qty',
      dataIndex: 'quantity_requested',
      key: 'quantity_requested',
      width: 80,
      align: 'center',
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: KitReorderPriority) => (
        <Tag color={getPriorityColor(priority)}>{priority.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: KitReorderStatus) => (
        <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Requested',
      dataIndex: 'requested_date',
      key: 'requested_date',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.requested_date).getTime() - new Date(b.requested_date).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Requester',
      dataIndex: 'requester',
      key: 'requester',
      width: 130,
      render: (requester: KitReorderRequest['requester']) =>
        requester ? `${requester.first_name} ${requester.last_name}` : 'Unknown',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_: unknown, record: KitReorderRequest) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  // Calculate statistics
  const stats = {
    pending: reorders.filter(r => r.status === 'pending').length,
    ordered: reorders.filter(r => r.status === 'ordered').length,
    fulfilled: reorders.filter(r => r.status === 'fulfilled').length,
    total: reorders.length,
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Header Stats */}
      <Row gutter={16}>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Space>
              <Badge status="warning" />
              <Text>Pending: <strong>{stats.pending}</strong></Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Space>
              <Badge status="processing" />
              <Text>Ordered: <strong>{stats.ordered}</strong></Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Space>
              <Badge status="success" />
              <Text>Fulfilled: <strong>{stats.fulfilled}</strong></Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Space>
              <Badge status="default" />
              <Text>Total: <strong>{stats.total}</strong></Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Main Content Card */}
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              <ShoppingCartOutlined /> Kit Replenishment
            </Title>
          </Space>
        }
        extra={
          <Space>
            <Tooltip title="View in Requests">
              <Button icon={<LinkOutlined />} onClick={navigateToRequests}>
                View All Requests
              </Button>
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              New Reorder
            </Button>
          </Space>
        }
      >
        {/* Filters */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Select
              placeholder="Filter by Status"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: 'Pending', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Ordered', value: 'ordered' },
                { label: 'Fulfilled', value: 'fulfilled' },
                { label: 'Cancelled', value: 'cancelled' },
              ]}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select
              placeholder="Filter by Priority"
              allowClear
              style={{ width: '100%' }}
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Urgent', value: 'urgent' },
              ]}
            />
          </Col>
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={reorders}
          rowKey="id"
          loading={isLoading || isApproving || isCancelling}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} reorder requests`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No reorder requests found"
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create Reorder Request
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create Reorder Modal */}
      <CreateReorderModal
        open={createModalOpen}
        kitId={kitId}
        kitName={kitName}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          refetch();
        }}
      />

      {/* Reorder Detail Modal */}
      {selectedReorder && (
        <ReorderDetailModal
          open={detailModalOpen}
          reorder={selectedReorder}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedReorder(null);
          }}
          onApprove={() => handleApprove(selectedReorder)}
          onMarkOrdered={() => {
            setDetailModalOpen(false);
            setMarkOrderedModalOpen(true);
          }}
          onFulfill={() => {
            setDetailModalOpen(false);
            setFulfillModalOpen(true);
          }}
          onCancel={() => handleCancel(selectedReorder)}
        />
      )}

      {/* Mark Ordered Modal */}
      {selectedReorder && (
        <MarkOrderedModal
          open={markOrderedModalOpen}
          reorder={selectedReorder}
          onClose={() => {
            setMarkOrderedModalOpen(false);
            setSelectedReorder(null);
          }}
          onSuccess={() => {
            setMarkOrderedModalOpen(false);
            setSelectedReorder(null);
            refetch();
          }}
        />
      )}

      {/* Fulfill Reorder Modal */}
      {selectedReorder && (
        <FulfillReorderModal
          open={fulfillModalOpen}
          reorder={selectedReorder}
          kitId={kitId}
          onClose={() => {
            setFulfillModalOpen(false);
            setSelectedReorder(null);
          }}
          onSuccess={() => {
            setFulfillModalOpen(false);
            setSelectedReorder(null);
            refetch();
          }}
        />
      )}
    </Space>
  );
};

export default KitReordersTab;
