import { useEffect, useCallback } from 'react';
import { Form, Input, Select, Button, Space, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { Warehouse, WarehouseFormData } from '../types';

const { Option } = Select;

interface WarehouseFormProps {
  form: FormInstance;
  initialValues?: Warehouse | null;
  onSubmit: (values: WarehouseFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const WarehouseForm = ({ form, initialValues, onSubmit, onCancel, loading }: WarehouseFormProps) => {
  const isEditing = !!initialValues;

  const getInitialFormValues = useCallback(() => {
    if (!initialValues) {
      return {
        warehouse_type: 'satellite',
        is_active: true,
        country: 'USA',
      };
    }

    return {
      name: initialValues.name,
      address: initialValues.address || undefined,
      city: initialValues.city || undefined,
      state: initialValues.state || undefined,
      zip_code: initialValues.zip_code || undefined,
      country: initialValues.country || 'USA',
      warehouse_type: initialValues.warehouse_type,
      is_active: initialValues.is_active,
      contact_person: initialValues.contact_person || undefined,
      contact_phone: initialValues.contact_phone || undefined,
      contact_email: initialValues.contact_email || undefined,
    };
  }, [initialValues]);

  useEffect(() => {
    form.setFieldsValue(getInitialFormValues());
  }, [initialValues, form, getInitialFormValues]);

  const handleFinish = (values: WarehouseFormData) => {
    onSubmit(values);
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
        label="Warehouse Name"
        name="name"
        rules={[{ required: true, message: 'Please enter warehouse name' }]}
      >
        <Input placeholder="e.g., Main Distribution Center" />
      </Form.Item>

      <Form.Item
        label="Warehouse Type"
        name="warehouse_type"
        rules={[{ required: true, message: 'Please select warehouse type' }]}
      >
        <Select>
          <Option value="main">Main</Option>
          <Option value="satellite">Satellite</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Address"
        name="address"
      >
        <Input placeholder="Street address" />
      </Form.Item>

      <Form.Item
        label="City"
        name="city"
      >
        <Input placeholder="City" />
      </Form.Item>

      <Form.Item
        label="State"
        name="state"
      >
        <Input placeholder="State" />
      </Form.Item>

      <Form.Item
        label="ZIP Code"
        name="zip_code"
      >
        <Input placeholder="ZIP code" />
      </Form.Item>

      <Form.Item
        label="Country"
        name="country"
      >
        <Input placeholder="Country" />
      </Form.Item>

      <Form.Item
        label="Contact Person"
        name="contact_person"
      >
        <Input placeholder="Contact name" />
      </Form.Item>

      <Form.Item
        label="Contact Phone"
        name="contact_phone"
      >
        <Input placeholder="Phone number" />
      </Form.Item>

      <Form.Item
        label="Contact Email"
        name="contact_email"
        rules={[{ type: 'email', message: 'Please enter a valid email' }]}
      >
        <Input placeholder="email@example.com" />
      </Form.Item>

      <Form.Item
        label="Active Status"
        name="is_active"
        valuePropName="checked"
      >
        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing ? 'Update Warehouse' : 'Create Warehouse'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
