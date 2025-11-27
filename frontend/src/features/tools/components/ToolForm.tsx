import { Form, Input, Select, InputNumber, Switch, DatePicker, Button, Space } from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import type { Tool, ToolFormData } from '../types';

const { Option } = Select;
const { TextArea } = Input;

interface ToolFormProps {
  form: FormInstance;
  initialValues?: Tool | null;
  onSubmit: (values: ToolFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ToolForm = ({ form, initialValues, onSubmit, onCancel, loading }: ToolFormProps) => {
  const isEditing = !!initialValues;

  // Convert Tool to ToolFormData for form initialization
  const getInitialFormValues = () => {
    if (!initialValues) return {};

    return {
      tool_number: initialValues.tool_number,
      serial_number: initialValues.serial_number,
      lot_number: initialValues.lot_number || undefined,
      description: initialValues.description,
      condition: initialValues.condition,
      location: initialValues.location,
      category: initialValues.category,
      status: initialValues.status,
      status_reason: initialValues.status_reason || undefined,
      warehouse_id: initialValues.warehouse_id || undefined,
      requires_calibration: initialValues.requires_calibration,
      calibration_frequency_days: initialValues.calibration_frequency_days || undefined,
      last_calibration_date: initialValues.last_calibration_date
        ? dayjs(initialValues.last_calibration_date)
        : undefined,
      next_calibration_date: initialValues.next_calibration_date
        ? dayjs(initialValues.next_calibration_date)
        : undefined,
    };
  };

  const handleFinish = (values: ToolFormData & { last_calibration_date?: dayjs.Dayjs; next_calibration_date?: dayjs.Dayjs }) => {
    // Convert dayjs objects to ISO strings
    const formData: ToolFormData = {
      ...values,
      last_calibration_date: values.last_calibration_date
        ? values.last_calibration_date.toISOString()
        : undefined,
      next_calibration_date: values.next_calibration_date
        ? values.next_calibration_date.toISOString()
        : undefined,
    };
    onSubmit(formData);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={getInitialFormValues()}
      onFinish={handleFinish}
      autoComplete="off"
    >
      <Form.Item
        label="Tool Number"
        name="tool_number"
        rules={[{ required: true, message: 'Please enter tool number' }]}
      >
        <Input placeholder="e.g., TL-001" />
      </Form.Item>

      <Form.Item
        label="Serial Number"
        name="serial_number"
        rules={[{ required: true, message: 'Please enter serial number' }]}
      >
        <Input placeholder="e.g., SN123456" />
      </Form.Item>

      <Form.Item
        label="Lot Number"
        name="lot_number"
      >
        <Input placeholder="Optional - for consumable tools" />
      </Form.Item>

      <Form.Item
        label="Description"
        name="description"
        rules={[{ required: true, message: 'Please enter description' }]}
      >
        <TextArea
          rows={3}
          placeholder="Describe the tool..."
        />
      </Form.Item>

      <Form.Item
        label="Category"
        name="category"
        initialValue="General"
      >
        <Select placeholder="Select category">
          <Option value="General">General</Option>
          <Option value="Precision">Precision</Option>
          <Option value="Power Tools">Power Tools</Option>
          <Option value="Measuring">Measuring</Option>
          <Option value="Cutting">Cutting</Option>
          <Option value="Hand Tools">Hand Tools</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Condition"
        name="condition"
        rules={[{ required: true, message: 'Please enter condition' }]}
      >
        <Select placeholder="Select condition">
          <Option value="New">New</Option>
          <Option value="Good">Good</Option>
          <Option value="Fair">Fair</Option>
          <Option value="Poor">Poor</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Location"
        name="location"
        rules={[{ required: true, message: 'Please enter location' }]}
      >
        <Input placeholder="e.g., Warehouse A, Shelf 3" />
      </Form.Item>

      <Form.Item
        label="Status"
        name="status"
        initialValue="available"
      >
        <Select placeholder="Select status">
          <Option value="available">Available</Option>
          <Option value="checked_out">Checked Out</Option>
          <Option value="maintenance">Maintenance</Option>
          <Option value="retired">Retired</Option>
        </Select>
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) =>
          prevValues.status !== currentValues.status
        }
      >
        {({ getFieldValue }) =>
          ['maintenance', 'retired'].includes(getFieldValue('status')) ? (
            <Form.Item
              label="Status Reason"
              name="status_reason"
              rules={[{ required: true, message: 'Please provide a reason' }]}
            >
              <TextArea
                rows={2}
                placeholder="Explain why the tool is in maintenance or retired..."
              />
            </Form.Item>
          ) : null
        }
      </Form.Item>

      <Form.Item
        label="Warehouse ID"
        name="warehouse_id"
      >
        <InputNumber
          style={{ width: '100%' }}
          placeholder="Optional - link to warehouse"
          min={1}
        />
      </Form.Item>

      <Form.Item
        label="Requires Calibration"
        name="requires_calibration"
        valuePropName="checked"
        initialValue={false}
      >
        <Switch />
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) =>
          prevValues.requires_calibration !== currentValues.requires_calibration
        }
      >
        {({ getFieldValue }) =>
          getFieldValue('requires_calibration') ? (
            <>
              <Form.Item
                label="Calibration Frequency (Days)"
                name="calibration_frequency_days"
                rules={[
                  {
                    required: true,
                    message: 'Please enter calibration frequency',
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="e.g., 365"
                  min={1}
                />
              </Form.Item>

              {isEditing && (
                <>
                  <Form.Item
                    label="Last Calibration Date"
                    name="last_calibration_date"
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>

                  <Form.Item
                    label="Next Calibration Date"
                    name="next_calibration_date"
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </>
              )}
            </>
          ) : null
        }
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing ? 'Update Tool' : 'Create Tool'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
