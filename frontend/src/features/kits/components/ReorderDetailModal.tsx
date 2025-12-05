import {
  Modal,
  Descriptions,
  Tag,
  Space,
  Button,
  Typography,
  Image,
  Divider,
  Timeline,
} from 'antd';
import {
  CheckCircleOutlined,
  ShoppingCartOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { KitReorderRequest, KitReorderStatus, KitReorderPriority } from '../../orders/types';

const { Text, Title } = Typography;

interface ReorderDetailModalProps {
  open: boolean;
  reorder: KitReorderRequest;
  onClose: () => void;
  onApprove: () => void;
  onMarkOrdered: () => void;
  onFulfill: () => void;
  onCancel: () => void;
}

const ReorderDetailModal = ({
  open,
  reorder,
  onClose,
  onApprove,
  onMarkOrdered,
  onFulfill,
  onCancel,
}: ReorderDetailModalProps) => {
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

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const getTimelineItems = () => {
    const items = [
      {
        color: 'green',
        dot: <ClockCircleOutlined />,
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Requested</Text>
            <Text type="secondary">{formatDate(reorder.requested_date)}</Text>
            {reorder.requester && (
              <Text type="secondary">
                <UserOutlined /> {reorder.requester.first_name} {reorder.requester.last_name}
              </Text>
            )}
          </Space>
        ),
      },
    ];

    if (reorder.approved_date) {
      items.push({
        color: 'blue',
        dot: <CheckCircleOutlined />,
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Approved</Text>
            <Text type="secondary">{formatDate(reorder.approved_date)}</Text>
            {reorder.approver && (
              <Text type="secondary">
                <UserOutlined /> {reorder.approver.first_name} {reorder.approver.last_name}
              </Text>
            )}
          </Space>
        ),
      });
    }

    if (reorder.status === 'ordered' && !reorder.fulfillment_date) {
      items.push({
        color: 'processing' as const,
        dot: <ShoppingCartOutlined />,
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Ordered</Text>
            <Text type="secondary">Order placed, awaiting fulfillment</Text>
          </Space>
        ),
      });
    }

    if (reorder.fulfillment_date) {
      items.push({
        color: 'green',
        dot: <CheckCircleOutlined />,
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Fulfilled</Text>
            <Text type="secondary">{formatDate(reorder.fulfillment_date)}</Text>
          </Space>
        ),
      });
    }

    if (reorder.status === 'cancelled') {
      items.push({
        color: 'red',
        dot: <CloseCircleOutlined />,
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Cancelled</Text>
          </Space>
        ),
      });
    }

    return items;
  };

  const renderFooterButtons = () => {
    const buttons: React.ReactNode[] = [
      <Button key="close" onClick={onClose}>
        Close
      </Button>,
    ];

    if (reorder.status === 'pending') {
      buttons.push(
        <Button
          key="cancel"
          danger
          icon={<CloseCircleOutlined />}
          onClick={onCancel}
        >
          Cancel Request
        </Button>,
        <Button
          key="order"
          icon={<ShoppingCartOutlined />}
          onClick={onMarkOrdered}
        >
          Mark as Ordered
        </Button>,
        <Button
          key="approve"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={onApprove}
        >
          Approve
        </Button>
      );
    }

    if (reorder.status === 'approved') {
      buttons.push(
        <Button
          key="order"
          type="primary"
          icon={<ShoppingCartOutlined />}
          onClick={onMarkOrdered}
        >
          Mark as Ordered
        </Button>
      );
    }

    if (reorder.status === 'ordered') {
      buttons.push(
        <Button
          key="fulfill"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={onFulfill}
        >
          Fulfill Order
        </Button>
      );
    }

    return buttons;
  };

  return (
    <Modal
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>Reorder Request Details</Title>
          <Tag color={getStatusColor(reorder.status)}>{reorder.status.toUpperCase()}</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={700}
      footer={renderFooterButtons()}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Item Information */}
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Part Number" span={2}>
            <Text strong>{reorder.part_number}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Description" span={2}>
            {reorder.description}
          </Descriptions.Item>
          <Descriptions.Item label="Item Type">
            <Tag>{reorder.item_type.toUpperCase()}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Quantity Requested">
            <Text strong>{reorder.quantity_requested}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Priority">
            <Tag color={getPriorityColor(reorder.priority)}>
              {reorder.priority.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Request Type">
            {reorder.is_automatic ? (
              <Tag color="geekblue">AUTOMATIC</Tag>
            ) : (
              <Tag>MANUAL</Tag>
            )}
          </Descriptions.Item>
          {reorder.kit && (
            <Descriptions.Item label="Kit" span={2}>
              {reorder.kit.name} ({reorder.kit.kit_number})
            </Descriptions.Item>
          )}
          {reorder.notes && (
            <Descriptions.Item label="Notes" span={2}>
              {reorder.notes}
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Image if available */}
        {reorder.image_path && (
          <>
            <Divider orientation="left">Attached Image</Divider>
            <Image
              src={reorder.image_path}
              alt="Reorder item image"
              style={{ maxWidth: '100%', maxHeight: 300 }}
              placeholder
            />
          </>
        )}

        {/* Timeline */}
        <Divider orientation="left">Request Timeline</Divider>
        <Timeline items={getTimelineItems()} />
      </Space>
    </Modal>
  );
};

export default ReorderDetailModal;
