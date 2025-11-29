import { useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Switch,
  Alert,
  Space,
  Typography,
  Tag,
  Divider,
  message,
  Descriptions,
} from 'antd';
import {
  ToolOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCheckinToolMutation } from '../services/checkoutApi';
import type { ToolCheckout, ToolCondition, DamageSeverity } from '../types';

const { Text, Title } = Typography;

interface CheckinModalProps {
  open: boolean;
  checkout: ToolCheckout | null;
  onClose: () => void;
}

const conditionOptions: { value: ToolCondition; label: string }[] = [
  { value: 'New', label: 'New' },
  { value: 'Good', label: 'Good' },
  { value: 'Fair', label: 'Fair' },
  { value: 'Poor', label: 'Poor' },
  { value: 'Damaged', label: 'Damaged' },
];

const severityOptions: { value: DamageSeverity; label: string; color: string }[] = [
  { value: 'minor', label: 'Minor - Tool still usable', color: 'orange' },
  { value: 'moderate', label: 'Moderate - Needs repair soon', color: 'gold' },
  { value: 'severe', label: 'Severe - Should not be used', color: 'red' },
  { value: 'unusable', label: 'Unusable - Completely broken', color: 'magenta' },
];

export const CheckinModal = ({ open, checkout, onClose }: CheckinModalProps) => {
  const [form] = Form.useForm();
  const [checkinTool, { isLoading }] = useCheckinToolMutation();

  const damageReported = Form.useWatch('damage_reported', form);

  useEffect(() => {
    if (open && checkout) {
      form.setFieldsValue({
        condition_at_return: checkout.condition_at_checkout,
        damage_reported: false,
      });
    }
  }, [open, checkout, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!checkout) return;

    try {
      const result = await checkinTool({
        checkoutId: checkout.id,
        data: {
          condition_at_return: values.condition_at_return as ToolCondition | undefined,
          return_notes: values.return_notes as string | undefined,
          damage_reported: values.damage_reported as boolean,
          damage_description: values.damage_reported
            ? (values.damage_description as string)
            : undefined,
          damage_severity: values.damage_reported
            ? (values.damage_severity as DamageSeverity)
            : undefined,
        },
      }).unwrap();

      if (result.damage_reported) {
        message.warning(`Tool ${checkout.tool_number} returned with damage reported`);
      } else {
        message.success(`Tool ${checkout.tool_number} returned successfully`);
      }

      handleClose();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to check in tool');
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  if (!checkout) return null;

  const isOverdue = checkout.is_overdue;
  const daysCheckedOut = dayjs().diff(dayjs(checkout.checkout_date), 'day');

  return (
    <Modal
      title={
        <Space>
          <ToolOutlined />
          Check In Tool
        </Space>
      }
      open={open}
      onCancel={handleClose}
      onOk={() => form.submit()}
      okText="Return Tool"
      okButtonProps={{ loading: isLoading }}
      width={600}
      destroyOnClose
    >
      {/* Tool Information */}
      <div
        style={{
          background: '#f5f5f5',
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {checkout.tool_number}
        </Title>
        <Text type="secondary">{checkout.serial_number}</Text>
        <div style={{ marginTop: 8 }}>
          <Text>{checkout.tool_description}</Text>
        </div>
        {checkout.tool_category && (
          <Tag style={{ marginTop: 8 }}>{checkout.tool_category}</Tag>
        )}
      </div>

      {/* Checkout Details */}
      <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Checked Out By">
          {checkout.user_name}
          {checkout.user_department && (
            <Text type="secondary"> ({checkout.user_department})</Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Checkout Date">
          {dayjs(checkout.checkout_date).format('MMM D, YYYY h:mm A')}
        </Descriptions.Item>
        <Descriptions.Item label="Days Checked Out">
          {daysCheckedOut} day{daysCheckedOut !== 1 ? 's' : ''}
        </Descriptions.Item>
        <Descriptions.Item label="Expected Return">
          {checkout.expected_return_date ? (
            <Space>
              {dayjs(checkout.expected_return_date).format('MMM D, YYYY')}
              {isOverdue && (
                <Tag color="error">
                  <WarningOutlined /> {checkout.days_overdue} days overdue
                </Tag>
              )}
            </Space>
          ) : (
            'Not specified'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Condition at Checkout">
          {checkout.condition_at_checkout || 'Not recorded'}
        </Descriptions.Item>
        {checkout.work_order && (
          <Descriptions.Item label="Work Order">
            {checkout.work_order}
          </Descriptions.Item>
        )}
        {checkout.project && (
          <Descriptions.Item label="Project">{checkout.project}</Descriptions.Item>
        )}
      </Descriptions>

      {isOverdue && (
        <Alert
          type="warning"
          message="This checkout is overdue"
          description={`This tool was expected back ${checkout.days_overdue} day(s) ago.`}
          style={{ marginBottom: 16 }}
          icon={<ExclamationCircleOutlined />}
          showIcon
        />
      )}

      <Divider>Return Details</Divider>

      {/* Return Form */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          condition_at_return: checkout.condition_at_checkout,
          damage_reported: false,
        }}
      >
        <Form.Item
          label="Condition at Return"
          name="condition_at_return"
          rules={[{ required: true, message: 'Please select condition' }]}
        >
          <Select options={conditionOptions} />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <WarningOutlined style={{ color: '#faad14' }} />
              Report Damage
            </Space>
          }
          name="damage_reported"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        {damageReported && (
          <>
            <Alert
              type="warning"
              message="Damage Reporting"
              description="Please provide details about the damage. Tools with severe damage will be automatically placed in maintenance."
              style={{ marginBottom: 16 }}
            />

            <Form.Item
              label="Damage Severity"
              name="damage_severity"
              rules={[
                {
                  required: damageReported,
                  message: 'Please select damage severity',
                },
              ]}
            >
              <Select placeholder="Select severity">
                {severityOptions.map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>
                    <Tag color={opt.color}>{opt.value.toUpperCase()}</Tag>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Damage Description"
              name="damage_description"
              rules={[
                {
                  required: damageReported,
                  message: 'Please describe the damage',
                },
              ]}
            >
              <Input.TextArea
                rows={4}
                placeholder="Describe the damage in detail..."
              />
            </Form.Item>
          </>
        )}

        <Form.Item label="Return Notes" name="return_notes">
          <Input.TextArea rows={2} placeholder="Any additional notes about this return..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};
