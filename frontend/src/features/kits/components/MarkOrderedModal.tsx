import {
  Modal,
  Form,
  Input,
  Typography,
  Descriptions,
  Tag,
  Alert,
  message,
} from 'antd';
import { useMarkKitReorderAsOrderedMutation } from '../../orders/services/kitReordersApi';
import type { KitReorderRequest, KitReorderPriority } from '../../orders/types';

const { Text } = Typography;

interface MarkOrderedModalProps {
  open: boolean;
  reorder: KitReorderRequest;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  vendor?: string;
  tracking_number?: string;
}

const MarkOrderedModal = ({
  open,
  reorder,
  onClose,
  onSuccess,
}: MarkOrderedModalProps) => {
  const [form] = Form.useForm<FormValues>();
  const [markOrdered, { isLoading }] = useMarkKitReorderAsOrderedMutation();

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

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      await markOrdered({
        reorderId: reorder.id,
        vendor: values.vendor,
        trackingNumber: values.tracking_number,
      }).unwrap();

      message.success('Reorder marked as ordered successfully');
      form.resetFields();
      onSuccess();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to mark reorder as ordered');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Mark as Ordered"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText="Mark as Ordered"
      confirmLoading={isLoading}
      width={550}
      destroyOnClose
    >
      <Alert
        message="Create Procurement Order"
        description="This will create a procurement order to track this request through the purchasing process. The order will be visible in the Orders page."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* Item Summary */}
      <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Part Number">
          <Text strong>{reorder.part_number}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Description">
          {reorder.description}
        </Descriptions.Item>
        <Descriptions.Item label="Quantity">
          {reorder.quantity_requested}
        </Descriptions.Item>
        <Descriptions.Item label="Priority">
          <Tag color={getPriorityColor(reorder.priority)}>
            {reorder.priority.toUpperCase()}
          </Tag>
        </Descriptions.Item>
      </Descriptions>

      <Form form={form} layout="vertical">
        <Form.Item
          name="vendor"
          label="Vendor (Optional)"
          extra={<Text type="secondary">Enter the vendor or supplier name if known</Text>}
        >
          <Input placeholder="e.g., Grainger, McMaster-Carr, etc." />
        </Form.Item>

        <Form.Item
          name="tracking_number"
          label="Tracking Number (Optional)"
          extra={<Text type="secondary">Enter PO number or tracking info if available</Text>}
        >
          <Input placeholder="e.g., PO-12345 or tracking number" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MarkOrderedModal;
