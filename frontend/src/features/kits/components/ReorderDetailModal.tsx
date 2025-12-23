import React, { useState } from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Space,
  Button,
  Spin,
  Alert,
  Typography,
  Card,
  Timeline,
  Image,
  message,
  Popconfirm,
} from 'antd';
import {
  CheckOutlined,
  ShoppingOutlined,
  InboxOutlined,
  CloseOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  useGetReorderDetailsQuery,
  useApproveReorderMutation,
  useMarkReorderOrderedMutation,
  useCancelReorderMutation,
} from '../services/kitsApi';
import type { ReorderStatus, ReorderPriority } from '../types';
import ReorderFulfillmentModal from './ReorderFulfillmentModal';

const { Title, Text, Link } = Typography;

interface ReorderDetailModalProps {
  open: boolean;
  reorderId: number;
  onClose: () => void;
}

const ReorderDetailModal = ({ open, reorderId, onClose }: ReorderDetailModalProps) => {
  const [fulfillmentModalVisible, setFulfillmentModalVisible] = useState(false);

  const { data: reorder, isLoading, error } = useGetReorderDetailsQuery(reorderId, {
    skip: !open || !reorderId,
  });

  const [approveReorder, { isLoading: isApproving }] = useApproveReorderMutation();
  const [markOrdered, { isLoading: isMarkingOrdered }] = useMarkReorderOrderedMutation();
  const [cancelReorder, { isLoading: isCancelling }] = useCancelReorderMutation();

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

  const handleApprove = async () => {
    try {
      await approveReorder(reorderId).unwrap();
      message.success('Reorder approved successfully!');
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to approve reorder');
    }
  };

  const handleMarkOrdered = async () => {
    try {
      await markOrdered(reorderId).unwrap();
      message.success('Reorder marked as ordered successfully!');
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to mark reorder as ordered');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelReorder(reorderId).unwrap();
      message.success('Reorder cancelled successfully!');
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to cancel reorder');
    }
  };

  const handleFulfill = () => {
    setFulfillmentModalVisible(true);
  };

  const renderActions = () => {
    if (!reorder) return null;

    const actions: React.ReactElement[] = [];

    switch (reorder.status) {
      case 'pending':
        actions.push(
          <Button
            key="approve"
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleApprove}
            loading={isApproving}
          >
            Approve
          </Button>
        );
        actions.push(
          <Popconfirm
            key="cancel"
            title="Are you sure you want to cancel this reorder?"
            onConfirm={handleCancel}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<CloseOutlined />} loading={isCancelling} danger>
              Cancel
            </Button>
          </Popconfirm>
        );
        break;

      case 'approved':
        actions.push(
          <Button
            key="mark-ordered"
            type="primary"
            icon={<ShoppingOutlined />}
            onClick={handleMarkOrdered}
            loading={isMarkingOrdered}
          >
            Mark as Ordered
          </Button>
        );
        actions.push(
          <Popconfirm
            key="cancel"
            title="Are you sure you want to cancel this reorder?"
            onConfirm={handleCancel}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<CloseOutlined />} loading={isCancelling} danger>
              Cancel
            </Button>
          </Popconfirm>
        );
        break;

      case 'ordered':
        actions.push(
          <Button
            key="fulfill"
            type="primary"
            icon={<InboxOutlined />}
            onClick={handleFulfill}
          >
            Fulfill
          </Button>
        );
        actions.push(
          <Popconfirm
            key="cancel"
            title="Are you sure you want to cancel this reorder?"
            onConfirm={handleCancel}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<CloseOutlined />} loading={isCancelling} danger>
              Cancel
            </Button>
          </Popconfirm>
        );
        break;

      default:
        // No actions for fulfilled or cancelled
        break;
    }

    return actions;
  };

  const renderTimeline = () => {
    if (!reorder) return null;

    const items = [
      {
        color: 'green',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Requested</Text>
            <Text type="secondary">
              {new Date(reorder.requested_date).toLocaleString()}
            </Text>
            <Text>By: {reorder.requester_name || 'Unknown'}</Text>
          </Space>
        ),
      },
    ];

    if (reorder.approved_date) {
      items.push({
        color: 'blue',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Approved</Text>
            <Text type="secondary">
              {new Date(reorder.approved_date).toLocaleString()}
            </Text>
            <Text>By: {reorder.approver_name || 'Unknown'}</Text>
          </Space>
        ),
      });
    }

    if (reorder.status === 'ordered') {
      items.push({
        color: 'blue',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Ordered</Text>
            <Text type="secondary">Awaiting fulfillment</Text>
          </Space>
        ),
      });
    }

    if (reorder.fulfillment_date) {
      items.push({
        color: 'green',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Fulfilled</Text>
            <Text type="secondary">
              {new Date(reorder.fulfillment_date).toLocaleString()}
            </Text>
          </Space>
        ),
      });
    }

    if (reorder.status === 'cancelled') {
      items.push({
        color: 'red',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Cancelled</Text>
          </Space>
        ),
      });
    }

    return <Timeline items={items} />;
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <span style={{ fontSize: 24 }}>
              {reorder ? getItemTypeIcon(reorder.item_type) : ''}
            </span>
            <Title level={4} style={{ margin: 0 }}>
              Reorder Request Details
            </Title>
          </Space>
        }
        open={open}
        onCancel={onClose}
        width={900}
        footer={[
          <Button key="close" onClick={onClose}>
            Close
          </Button>,
          ...(renderActions() || []),
        ]}
      >
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        )}

        {error && (
          <Alert
            message="Error"
            description="Failed to load reorder details. Please try again."
            type="error"
            showIcon
          />
        )}

        {reorder && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Status Alerts */}
            {reorder.priority === 'urgent' && reorder.status !== 'fulfilled' && (
              <Alert
                message="Urgent Priority"
                description="This reorder request has been marked as urgent and requires immediate attention."
                type="error"
                showIcon
                icon={<WarningOutlined />}
              />
            )}

            {reorder.is_automatic && (
              <Alert
                message="Automatic Reorder"
                description="This reorder was automatically created due to low stock levels."
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
              />
            )}

            {/* Item Information */}
            <Card title="Item Information">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Item Type">
                  <Space>
                    <span style={{ fontSize: 20 }}>
                      {getItemTypeIcon(reorder.item_type)}
                    </span>
                    <Text strong>
                      {reorder.item_type.charAt(0).toUpperCase() +
                        reorder.item_type.slice(1)}
                    </Text>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(reorder.status)}>
                    {reorder.status.replace('_', ' ').toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Part Number" span={2}>
                  <Text strong>{reorder.part_number}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                  {reorder.description}
                </Descriptions.Item>
                <Descriptions.Item label="Quantity Requested">
                  <Text strong style={{ fontSize: 16 }}>
                    {reorder.quantity_requested}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Priority">
                  <Tag color={getPriorityColor(reorder.priority)}>
                    {reorder.priority.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                {reorder.notes && (
                  <Descriptions.Item label="Notes" span={2}>
                    {reorder.notes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Image */}
            {reorder.image_path && (
              <Card title="Item Image">
                <Image
                  src={reorder.image_path}
                  alt="Reorder item"
                  style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }}
                />
              </Card>
            )}

            {/* Links */}
            <Card title="Associated Records">
              <Descriptions bordered>
                <Descriptions.Item label="Kit">
                  <Text strong>{reorder.kit_name || `Kit #${reorder.kit_id}`}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="User Request">
                  {reorder.user_request ? (
                    <Space>
                      <Link href={`/requests/${reorder.user_request.id}`}>
                        Request #{reorder.user_request.request_number}
                      </Link>
                      <Tag color="blue">{reorder.user_request.status}</Tag>
                    </Space>
                  ) : (
                    <Text type="secondary">Not created</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Procurement Orders" span={2}>
                  {reorder.procurement_orders && reorder.procurement_orders.length > 0 ? (
                    <Space wrap>
                      {reorder.procurement_orders.map((order) => (
                        <Space key={order.id}>
                          <Link href={`/orders/${order.id}`}>
                            PO #{order.order_number}
                          </Link>
                          <Tag color="green">{order.status}</Tag>
                        </Space>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">No orders created</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Timeline */}
            <Card title="Status Timeline">{renderTimeline()}</Card>
          </Space>
        )}
      </Modal>

      {reorder && (
        <ReorderFulfillmentModal
          visible={fulfillmentModalVisible}
          reorder={reorder}
          onClose={() => setFulfillmentModalVisible(false)}
        />
      )}
    </>
  );
};

export default ReorderDetailModal;
