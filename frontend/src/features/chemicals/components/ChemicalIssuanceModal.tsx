import { useEffect } from 'react';
import {
  Modal,
  Form,
  InputNumber,
  Input,
  Select,
  message,
  Alert,
  Space,
  Typography,
} from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useIssueChemicalMutation } from '../services/chemicalsApi';
import { useGetUsersQuery } from '@features/users/services/usersApi';
import { useAppSelector } from '@app/hooks';
import type { Chemical } from '../types';

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;

interface ChemicalIssuanceModalProps {
  open: boolean;
  chemical: Chemical | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChemicalIssuanceModal = ({
  open,
  chemical,
  onClose,
  onSuccess,
}: ChemicalIssuanceModalProps) => {
  const [form] = Form.useForm();
  const [issueChemical, { isLoading }] = useIssueChemicalMutation();
  const { data: users } = useGetUsersQuery();
  const currentUser = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    if (open && chemical) {
      form.setFieldsValue({
        quantity: 1,
        hangar: '',
        user_id: currentUser?.id,
        purpose: '',
        work_order: '',
        notes: '',
      });
    }
  }, [open, chemical, form, currentUser]);

  const handleSubmit = async () => {
    if (!chemical) return;

    try {
      const values = await form.validateFields();

      const result = await issueChemical({
        id: chemical.id,
        data: {
          quantity: values.quantity,
          hangar: values.hangar,
          user_id: values.user_id,
          purpose: values.purpose || undefined,
          work_order: values.work_order || undefined,
        },
      }).unwrap();

      message.success('Chemical issued successfully');

      // Show auto-reorder notice if applicable
      if (result.message) {
        message.info(result.message);
      }

      onClose();
      form.resetFields();
      onSuccess?.();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to issue chemical');
    }
  };

  const handleCancel = () => {
    onClose();
    form.resetFields();
  };

  if (!chemical) return null;

  const isLowStock =
    chemical.minimum_stock_level !== null &&
    chemical.minimum_stock_level !== undefined &&
    chemical.quantity <= chemical.minimum_stock_level;

  const isExpired = chemical.status === 'expired';
  const isOutOfStock = chemical.quantity <= 0;

  const willTriggerReorder = (quantity: number) => {
    return (
      chemical.minimum_stock_level !== null &&
      chemical.minimum_stock_level !== undefined &&
      chemical.quantity - quantity <= chemical.minimum_stock_level
    );
  };

  return (
    <Modal
      title="Issue Chemical"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={isLoading}
      okButtonProps={{ disabled: isExpired || isOutOfStock }}
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Chemical Information */}
        <div>
          <Text strong>Part Number: </Text>
          <Text>{chemical.part_number}</Text>
          <br />
          <Text strong>Lot Number: </Text>
          <Text>{chemical.lot_number}</Text>
          {chemical.description && (
            <>
              <br />
              <Text strong>Description: </Text>
              <Text>{chemical.description}</Text>
            </>
          )}
          <br />
          <Text strong>Available Quantity: </Text>
          <Text>
            {chemical.quantity} {chemical.unit}
          </Text>
          {chemical.minimum_stock_level !== null &&
            chemical.minimum_stock_level !== undefined && (
              <>
                <br />
                <Text strong>Minimum Stock Level: </Text>
                <Text>{chemical.minimum_stock_level}</Text>
              </>
            )}
        </div>

        {/* Warning Alerts */}
        {isExpired && (
          <Alert
            message="Expired Chemical"
            description="This chemical has expired and cannot be issued."
            type="error"
            showIcon
          />
        )}

        {isOutOfStock && !isExpired && (
          <Alert
            message="Out of Stock"
            description="This chemical is out of stock and cannot be issued."
            type="error"
            showIcon
          />
        )}

        {isLowStock && !isExpired && !isOutOfStock && (
          <Alert
            message="Low Stock Warning"
            description={`This chemical is at or below minimum stock level (${chemical.minimum_stock_level}). Issuing will trigger an automatic reorder request.`}
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
                min: 1,
                max: chemical.quantity,
                message: `Quantity must be between 1 and ${chemical.quantity}`,
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={chemical.quantity}
              step={1}
              placeholder="Enter quantity"
              addonAfter={chemical.unit}
              disabled={isExpired || isOutOfStock}
              onChange={(value) => {
                if (value && willTriggerReorder(value) && !isLowStock) {
                  message.info('This quantity will trigger an automatic reorder request');
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="hangar"
            label="Hangar / Location"
            rules={[
              { required: true, message: 'Please enter hangar or location' },
              { max: 100, message: 'Hangar must be at most 100 characters' },
            ]}
          >
            <Input
              placeholder="Enter hangar or location (e.g., Hangar A, Bay 1)"
              disabled={isExpired || isOutOfStock}
            />
          </Form.Item>

          <Form.Item
            name="user_id"
            label="Issue To"
            rules={[{ required: true, message: 'Please select a user' }]}
          >
            <Select
              placeholder="Select user"
              showSearch
              optionFilterProp="children"
              disabled={isExpired || isOutOfStock}
            >
              {users?.map((user) => (
                <Option key={user.id} value={user.id}>
                  {user.name} ({user.employee_number})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="work_order"
            label="Work Order"
            rules={[{ max: 100, message: 'Work order must be at most 100 characters' }]}
          >
            <Input
              placeholder="Related work order number (optional)"
              disabled={isExpired || isOutOfStock}
            />
          </Form.Item>

          <Form.Item
            name="purpose"
            label="Purpose"
            rules={[{ max: 500, message: 'Purpose must be at most 500 characters' }]}
          >
            <TextArea
              rows={2}
              placeholder="Purpose of issuance (optional)"
              disabled={isExpired || isOutOfStock}
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
};

export default ChemicalIssuanceModal;
