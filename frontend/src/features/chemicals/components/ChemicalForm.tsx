import { useEffect, useCallback } from 'react';
import { Form, Input, InputNumber, Select, DatePicker, Button, Space } from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import type { Chemical, ChemicalFormData } from '../types';

const { Option } = Select;
const { TextArea } = Input;

interface ChemicalFormProps {
  form: FormInstance;
  initialValues?: Chemical | null;
  onSubmit: (values: ChemicalFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ChemicalForm = ({ form, initialValues, onSubmit, onCancel, loading }: ChemicalFormProps) => {
  const isEditing = !!initialValues;

  const getInitialFormValues = useCallback(() => {
    if (!initialValues) return {};

    return {
      part_number: initialValues.part_number,
      lot_number: initialValues.lot_number,
      description: initialValues.description || undefined,
      manufacturer: initialValues.manufacturer || undefined,
      quantity: initialValues.quantity,
      unit: initialValues.unit,
      location: initialValues.location || undefined,
      category: initialValues.category || undefined,
      status: initialValues.status,
      warehouse_id: initialValues.warehouse_id || undefined,
      expiration_date: initialValues.expiration_date
        ? dayjs(initialValues.expiration_date)
        : undefined,
      minimum_stock_level: initialValues.minimum_stock_level || undefined,
      notes: initialValues.notes || undefined,
    };
  }, [initialValues]);

  // Update form when initialValues change (e.g., switching between chemicals)
  useEffect(() => {
    form.setFieldsValue(getInitialFormValues());
  }, [initialValues, form, getInitialFormValues]);

  const handleFinish = (
    values: ChemicalFormData & {
      expiration_date?: dayjs.Dayjs;
    }
  ) => {
    const formData: ChemicalFormData = {
      ...values,
      expiration_date: values.expiration_date
        ? values.expiration_date.toISOString()
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
        label="Part Number"
        name="part_number"
        rules={[{ required: true, message: 'Please enter part number' }]}
      >
        <Input placeholder="e.g., CH-001" />
      </Form.Item>

      <Form.Item
        label="Lot Number"
        name="lot_number"
        rules={[{ required: true, message: 'Please enter lot number' }]}
      >
        <Input placeholder="e.g., LOT-123" />
      </Form.Item>

      <Form.Item
        label="Description"
        name="description"
      >
        <TextArea rows={3} placeholder="Describe the chemical" />
      </Form.Item>

      <Form.Item
        label="Manufacturer"
        name="manufacturer"
      >
        <Input placeholder="Manufacturer name" />
      </Form.Item>

      <Form.Item
        label="Quantity"
        name="quantity"
        rules={[{ required: true, message: 'Please enter quantity' }]}
      >
        <InputNumber style={{ width: '100%' }} min={0} />
      </Form.Item>

      <Form.Item
        label="Unit"
        name="unit"
        rules={[{ required: true, message: 'Please select a unit' }]}
      >
        <Select placeholder="Select unit">
          <Option value="each">Each</Option>
          <Option value="ml">Milliliters (ml)</Option>
          <Option value="l">Liters (l)</Option>
          <Option value="oz">Ounces (oz)</Option>
          <Option value="gal">Gallons (gal)</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Location"
        name="location"
        rules={[{ required: true, message: 'Please enter the storage location (e.g., shelf, bin)' }]}
      >
        <Input placeholder="e.g., Shelf A-1, Bin 5" />
      </Form.Item>

      <Form.Item
        label="Category"
        name="category"
      >
        <Select placeholder="Select category" allowClear>
          <Option value="General">General</Option>
          <Option value="Sealant">Sealant</Option>
          <Option value="Paint">Paint</Option>
          <Option value="Adhesive">Adhesive</Option>
          <Option value="Solvent">Solvent</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Status"
        name="status"
        initialValue="available"
      >
        <Select>
          <Option value="available">Available</Option>
          <Option value="low_stock">Low Stock</Option>
          <Option value="out_of_stock">Out of Stock</Option>
          <Option value="expired">Expired</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Warehouse ID"
        name="warehouse_id"
        rules={[{ required: true, message: 'Warehouse is required' }]}
      >
        <InputNumber style={{ width: '100%' }} min={1} />
      </Form.Item>

      <Form.Item
        label="Expiration Date"
        name="expiration_date"
      >
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        label="Minimum Stock Level"
        name="minimum_stock_level"
      >
        <InputNumber style={{ width: '100%' }} min={0} />
      </Form.Item>

      <Form.Item
        label="Notes"
        name="notes"
      >
        <TextArea rows={2} placeholder="Additional notes" />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing ? 'Update Chemical' : 'Create Chemical'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
