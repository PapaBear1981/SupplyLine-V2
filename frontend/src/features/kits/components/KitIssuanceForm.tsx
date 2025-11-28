import { useEffect } from 'react';
import { Modal, Form, InputNumber, Input, message, Alert, Space, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useIssueFromKitMutation } from '../services/kitsApi';
import type { KitItem } from '../types';

const { TextArea } = Input;
const { Text } = Typography;

interface KitIssuanceFormProps {
  visible: boolean;
  kitId: number;
  item: KitItem | null;
  onClose: () => void;
}

const KitIssuanceForm = ({ visible, kitId, item, onClose }: KitIssuanceFormProps) => {
  const [form] = Form.useForm();
  const [issueFromKit, { isLoading }] = useIssueFromKitMutation();

  useEffect(() => {
    if (visible && item) {
      form.setFieldsValue({
        quantity: 1,
        purpose: '',
        work_order: '',
        notes: '',
      });
    }
  }, [visible, item, form]);

  const handleSubmit = async () => {
    if (!item) return;

    try {
      const values = await form.validateFields();

      await issueFromKit({
        kitId,
        data: {
          item_type: item.item_type,
          item_id: item.id,
          quantity: values.quantity,
          purpose: values.purpose,
          work_order: values.work_order,
          notes: values.notes,
        },
      }).unwrap();

      message.success('Item issued successfully');

      // Show auto-reorder notice if applicable
      if (item.minimum_stock_level &&
          (item.quantity - values.quantity) <= item.minimum_stock_level) {
        message.info('Automatic reorder request created due to low stock level');
      }

      onClose();
      form.resetFields();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to issue item');
    }
  };

  const handleCancel = () => {
    onClose();
    form.resetFields();
  };

  if (!item) return null;

  const isLowStock = item.minimum_stock_level && item.quantity <= item.minimum_stock_level;
  const willTriggerReorder = (quantity: number) => {
    return item.minimum_stock_level && (item.quantity - quantity) <= item.minimum_stock_level;
  };

  return (
    <Modal
      title="Issue Item from Kit"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={isLoading}
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Item Information */}
        <div>
          <Text strong>Item: </Text>
          <Text>{item.description}</Text>
          <br />
          <Text strong>Part Number: </Text>
          <Text>{item.part_number}</Text>
          {item.serial_number && (
            <>
              <br />
              <Text strong>Serial Number: </Text>
              <Text>{item.serial_number}</Text>
            </>
          )}
          {item.lot_number && (
            <>
              <br />
              <Text strong>Lot Number: </Text>
              <Text>{item.lot_number}</Text>
            </>
          )}
          <br />
          <Text strong>Available Quantity: </Text>
          <Text>{item.quantity}</Text>
          {('unit' in item) && item.unit && <Text type="secondary"> {item.unit}</Text>}
        </div>

        {/* Low Stock Warning */}
        {isLowStock && (
          <Alert
            message="Low Stock Warning"
            description={`This item is at or below minimum stock level (${item.minimum_stock_level}). Issuing will trigger an automatic reorder request.`}
            type="warning"
            showIcon
            icon={<WarningOutlined />}
          />
        )}

        {/* Form */}
        <Form form={form} layout="vertical">
          <Form.Item
            name="quantity"
            label="Quantity to Issue"
            rules={[
              { required: true, message: 'Please enter quantity' },
              {
                type: 'number',
                min: 0.01,
                max: item.quantity,
                message: `Quantity must be between 0.01 and ${item.quantity}`,
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              max={item.quantity}
              step={0.01}
              placeholder="Enter quantity"
              onChange={(value) => {
                if (value && willTriggerReorder(value) && !isLowStock) {
                  message.info('This quantity will trigger an automatic reorder request');
                }
              }}
            />
          </Form.Item>

          <Form.Item name="purpose" label="Purpose">
            <Input placeholder="Purpose of issuance (optional)" />
          </Form.Item>

          <Form.Item name="work_order" label="Work Order">
            <Input placeholder="Related work order number (optional)" />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Additional notes (optional)" />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
};

export default KitIssuanceForm;
