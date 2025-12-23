import { useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Space,
  Typography,
  Descriptions,
  Tag,
  Alert,
  message,
  Button,
} from 'antd';
import { InboxOutlined, WarningOutlined } from '@ant-design/icons';
import {
  useFulfillReorderMutation,
  useGetKitBoxesQuery,
} from '../services/kitsApi';
import type { KitReorderRequest } from '../types';

const { Option } = Select;
const { Text } = Typography;

interface ReorderFulfillmentModalProps {
  visible: boolean;
  reorder: KitReorderRequest;
  onClose: () => void;
}

const ReorderFulfillmentModal = ({
  visible,
  reorder,
  onClose,
}: ReorderFulfillmentModalProps) => {
  const [form] = Form.useForm();
  const [fulfillReorder, { isLoading }] = useFulfillReorderMutation();
  const { data: boxes = [] } = useGetKitBoxesQuery(reorder.kit_id, {
    skip: !visible,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        quantity: reorder.quantity_requested,
      });
    }
  }, [visible, reorder, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      await fulfillReorder({
        id: reorder.id,
        box_id: values.box_id,
      }).unwrap();

      message.success('Reorder fulfilled successfully! Item added back to kit.');
      form.resetFields();
      onClose();
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to fulfill reorder');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <InboxOutlined style={{ fontSize: 20, color: '#52c41a' }} />
          <Text strong>Fulfill Reorder Request</Text>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<InboxOutlined />}
          loading={isLoading}
          onClick={handleSubmit}
        >
          Fulfill Reorder
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="Fulfillment Process"
          description="This will mark the reorder as fulfilled and automatically add the item back to the selected kit box. The item will be created with the specified quantity."
          type="info"
          showIcon
        />

        {/* Order Details */}
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Part Number">
            <Text strong>{reorder.part_number}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Description">
            {reorder.description}
          </Descriptions.Item>
          <Descriptions.Item label="Item Type">
            <Tag color="blue">
              {reorder.item_type.charAt(0).toUpperCase() + reorder.item_type.slice(1)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Quantity Requested">
            <Text strong style={{ fontSize: 16 }}>
              {reorder.quantity_requested}
            </Text>
          </Descriptions.Item>
          {reorder.procurement_orders && reorder.procurement_orders.length > 0 && (
            <Descriptions.Item label="Procurement Order">
              <Space wrap>
                {reorder.procurement_orders.map((order) => (
                  <Tag key={order.id} color="green">
                    PO #{order.order_number}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Fulfillment Form */}
        <Form form={form} layout="vertical">
          <Form.Item
            name="box_id"
            label="Destination Box"
            rules={[{ required: true, message: 'Please select a destination box' }]}
          >
            <Select
              placeholder="Select box to place the item"
              showSearch
              optionFilterProp="children"
            >
              {boxes.map((box) => (
                <Option key={box.id} value={box.id}>
                  <Space>
                    <Text strong>{box.box_number}</Text>
                    {box.description && (
                      <Text type="secondary">- {box.description}</Text>
                    )}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {boxes.length === 0 && (
            <Alert
              message="No Boxes Available"
              description="This kit has no boxes. Please create a box first before fulfilling this reorder."
              type="warning"
              showIcon
              icon={<WarningOutlined />}
            />
          )}
        </Form>

        <Alert
          message="Note"
          description={
            <Space direction="vertical" size={0}>
              <Text>After fulfillment:</Text>
              <Text>• The item will be added to the selected box</Text>
              <Text>• The reorder status will be marked as "Fulfilled"</Text>
              <Text>
                • For expendables: A new item will be created with the requested quantity
              </Text>
              <Text>
                • For chemicals: The item will be transferred from warehouse inventory
              </Text>
            </Space>
          }
          type="info"
          showIcon
        />
      </Space>
    </Modal>
  );
};

export default ReorderFulfillmentModal;
