import React, { useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, Space, Collapse, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { MasterChemical, MasterChemicalFormData } from '../types';

const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

interface MasterChemicalFormProps {
  form: FormInstance;
  initialValues?: MasterChemical | null;
  onSubmit: (values: MasterChemicalFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const MasterChemicalForm: React.FC<MasterChemicalFormProps> = ({
  form,
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const isEditing = !!initialValues;

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        part_number: initialValues.part_number,
        description: initialValues.description,
        manufacturer: initialValues.manufacturer || undefined,
        category: initialValues.category,
        unit: initialValues.unit,
        shelf_life_days: initialValues.shelf_life_days || undefined,
        alternative_part_numbers: initialValues.alternative_part_numbers || [],
        hazard_class: initialValues.hazard_class || undefined,
        storage_requirements: initialValues.storage_requirements || undefined,
        sds_link: initialValues.sds_link || undefined,
      });
    } else {
      form.resetFields();
    }
  }, [initialValues, form]);

  const handleFinish = async (values: any) => {
    try {
      await onSubmit(values);
      message.success(`Master chemical ${isEditing ? 'updated' : 'created'} successfully`);
      form.resetFields();
    } catch (error: any) {
      message.error(error.message || `Failed to ${isEditing ? 'update' : 'create'} master chemical`);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      autoComplete="off"
    >
      <Form.Item
        label="Part Number"
        name="part_number"
        rules={[
          { required: true, message: 'Please enter part number' },
          { max: 100, message: 'Part number must be at most 100 characters' },
        ]}
      >
        <Input placeholder="e.g., CHEM-001" />
      </Form.Item>

      <Form.Item
        label="Description"
        name="description"
        rules={[
          { required: true, message: 'Please enter description' },
          { max: 500, message: 'Description must be at most 500 characters' },
        ]}
      >
        <TextArea rows={2} placeholder="Describe the chemical" />
      </Form.Item>

      <Form.Item
        label="Manufacturer"
        name="manufacturer"
        rules={[{ max: 200, message: 'Manufacturer must be at most 200 characters' }]}
      >
        <Input placeholder="e.g., 3M, Henkel, Dow" />
      </Form.Item>

      <Form.Item
        label="Category"
        name="category"
        initialValue="General"
      >
        <Select placeholder="Select category">
          <Option value="General">General</Option>
          <Option value="Sealant">Sealant</Option>
          <Option value="Paint">Paint</Option>
          <Option value="Adhesive">Adhesive</Option>
          <Option value="Solvent">Solvent</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Unit"
        name="unit"
        rules={[{ required: true, message: 'Please select unit' }]}
        initialValue="each"
      >
        <Select placeholder="Select unit">
          <Option value="each">Each</Option>
          <Option value="oz">Ounce (oz)</Option>
          <Option value="ml">Milliliter (ml)</Option>
          <Option value="l">Liter (l)</Option>
          <Option value="g">Gram (g)</Option>
          <Option value="kg">Kilogram (kg)</Option>
          <Option value="lb">Pound (lb)</Option>
          <Option value="gal">Gallon (gal)</Option>
          <Option value="tubes">Tubes</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Shelf Life (days)"
        name="shelf_life_days"
        help="Default shelf life for auto-calculating expiration dates. Leave blank if chemical does not expire."
        rules={[
          { type: 'number', min: 1, max: 7300, message: 'Shelf life must be between 1 and 7300 days' },
        ]}
      >
        <InputNumber
          style={{ width: '100%' }}
          placeholder="e.g., 365 (1 year), 730 (2 years)"
          min={1}
          max={7300}
        />
      </Form.Item>

      <Form.Item label="Alternative Part Numbers" help="Cross-references, manufacturer codes, or previous part numbers">
        <Form.List name="alternative_part_numbers">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={name}
                    rules={[{ required: true, message: 'Missing alternative part number' }]}
                    style={{ marginBottom: 0, flex: 1 }}
                  >
                    <Input placeholder="Alternative part number" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(name)} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Add Alternative Part Number
              </Button>
            </>
          )}
        </Form.List>
      </Form.Item>

      <Collapse ghost>
        <Panel header="Safety Data (Optional)" key="safety">
          <Form.Item
            label="Hazard Class"
            name="hazard_class"
            rules={[{ max: 100, message: 'Hazard class must be at most 100 characters' }]}
          >
            <Input placeholder="e.g., Flammable Liquid Category 3" />
          </Form.Item>

          <Form.Item
            label="Storage Requirements"
            name="storage_requirements"
            rules={[{ max: 500, message: 'Storage requirements must be at most 500 characters' }]}
          >
            <TextArea rows={2} placeholder="e.g., Store in cool, dry place. Keep away from heat sources." />
          </Form.Item>

          <Form.Item
            label="SDS Link"
            name="sds_link"
            rules={[
              { max: 500, message: 'SDS link must be at most 500 characters' },
              { type: 'url', message: 'Please enter a valid URL' },
            ]}
          >
            <Input placeholder="https://example.com/sds/product-sds.pdf" />
          </Form.Item>
        </Panel>
      </Collapse>

      <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing ? 'Update' : 'Create'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
