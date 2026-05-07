import { useEffect, useCallback, useState, useMemo } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Space,
  Radio,
  Alert,
} from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import type { Chemical, ChemicalFormData, ChemicalPart } from '../types';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import { useGetChemicalPartsQuery } from '../services/chemicalsApi';

const { Option } = Select;
const { TextArea } = Input;

type FormMode = 'existing' | 'new';

interface ChemicalFormProps {
  form: FormInstance;
  initialValues?: Chemical | null;
  onSubmit: (values: ChemicalFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ChemicalForm = ({
  form,
  initialValues,
  onSubmit,
  onCancel,
  loading,
}: ChemicalFormProps) => {
  const isEditing = !!initialValues;
  const { data: warehousesData, isLoading: warehousesLoading } = useGetWarehousesQuery({
    per_page: 200,
  });

  // When creating, default to "Add lot to existing part" since reusing an
  // existing part number is the most common case once a system has data.
  const [mode, setMode] = useState<FormMode>(isEditing ? 'new' : 'existing');

  const { data: partsData, isLoading: partsLoading } = useGetChemicalPartsQuery(
    { per_page: 500 },
    { skip: isEditing },
  );

  const parts: ChemicalPart[] = useMemo(
    () => partsData?.parts || [],
    [partsData],
  );

  const partOptions = useMemo(
    () =>
      parts.map((p) => ({
        label: `${p.part_number}${p.description ? ` — ${p.description}` : ''}`,
        value: p.id,
      })),
    [parts],
  );

  const getInitialFormValues = useCallback(() => {
    if (!initialValues) return {};

    return {
      part_number: initialValues.part_number,
      chemical_part_id: initialValues.chemical_part_id ?? undefined,
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

  // When the user picks an existing part, autopopulate the read-only part
  // fields so they can see what they're adding a lot to.
  const handlePartChange = (partId: number | undefined) => {
    if (!partId) {
      form.setFieldsValue({
        part_number: undefined,
        description: undefined,
        manufacturer: undefined,
        category: undefined,
        unit: undefined,
        minimum_stock_level: undefined,
      });
      return;
    }
    const part = parts.find((p) => p.id === partId);
    if (!part) return;
    form.setFieldsValue({
      part_number: part.part_number,
      description: part.description || undefined,
      manufacturer: part.manufacturer || undefined,
      category: part.category || undefined,
      unit: part.default_unit,
      minimum_stock_level: part.minimum_stock_level ?? undefined,
    });
  };

  const handleModeChange = (next: FormMode) => {
    setMode(next);
    // Reset the part-master fields when switching modes so stale values
    // from a previously selected existing part don't leak into a new part
    // submission (or vice versa).
    form.setFieldsValue({
      chemical_part_id: undefined,
      part_number: undefined,
      description: undefined,
      manufacturer: undefined,
      category: undefined,
      unit: undefined,
      minimum_stock_level: undefined,
    });
  };

  const handleFinish = (
    values: ChemicalFormData & {
      expiration_date?: dayjs.Dayjs;
    },
  ) => {
    const formData: ChemicalFormData = {
      ...values,
      expiration_date: values.expiration_date
        ? values.expiration_date.toISOString()
        : undefined,
    };
    // Only send chemical_part_id when we're explicitly attaching to an
    // existing part — sending null/undefined puts the request through the
    // "create new part" branch on the backend, which rejects duplicates.
    if (mode !== 'existing') {
      delete formData.chemical_part_id;
    }
    onSubmit(formData);
  };

  const isExistingMode = !isEditing && mode === 'existing';
  const isNewPartMode = isEditing || mode === 'new';

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={getInitialFormValues()}
      onFinish={handleFinish}
      autoComplete="off"
    >
      {!isEditing && (
        <Form.Item label="Mode">
          <Radio.Group
            value={mode}
            onChange={(e) => handleModeChange(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            data-testid="chemical-form-mode"
          >
            <Radio.Button value="existing">Add Lot to Existing Part</Radio.Button>
            <Radio.Button value="new">Create New Part Number</Radio.Button>
          </Radio.Group>
        </Form.Item>
      )}

      {isExistingMode && (
        <>
          <Form.Item
            label="Existing Part Number"
            name="chemical_part_id"
            rules={[
              {
                required: true,
                message: 'Select an existing part to add a lot to',
              },
            ]}
          >
            <Select
              showSearch
              placeholder="Search by part number or description"
              loading={partsLoading}
              optionFilterProp="label"
              options={partOptions}
              onChange={handlePartChange}
              data-testid="chemical-form-part-select"
            />
          </Form.Item>
          {/* Hidden field — the backend requires part_number even when
              chemical_part_id is provided, so we ship it back exactly as
              it was set by handlePartChange. */}
          <Form.Item name="part_number" hidden>
            <Input />
          </Form.Item>
        </>
      )}

      {isNewPartMode && (
        <Form.Item
          label="Part Number"
          name="part_number"
          rules={[{ required: true, message: 'Please enter part number' }]}
          extra={
            !isEditing
              ? "Must be a new part number. To add another lot to a part you've already received, use 'Add Lot to Existing Part'."
              : undefined
          }
        >
          <Input placeholder="e.g., CH-001" />
        </Form.Item>
      )}

      {isExistingMode && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="The fields below describe this lot. Part-level details are inherited from the selected part."
        />
      )}

      <Form.Item
        label="Lot Number"
        name="lot_number"
        rules={[{ required: true, message: 'Please enter lot number' }]}
      >
        <Input placeholder="e.g., LOT-123" />
      </Form.Item>

      {isNewPartMode && (
        <>
          <Form.Item label="Description" name="description">
            <TextArea rows={3} placeholder="Describe the chemical" />
          </Form.Item>

          <Form.Item label="Manufacturer" name="manufacturer">
            <Input placeholder="Manufacturer name" />
          </Form.Item>
        </>
      )}

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
        <Select placeholder="Select unit" disabled={isExistingMode}>
          <Option value="each">Each</Option>
          <Option value="tube">Tube</Option>
          <Option value="tubes">Tubes</Option>
          <Option value="can">Can</Option>
          <Option value="cartridge">Cartridge</Option>
          <Option value="kit">Kit</Option>
          <Option value="roll">Roll</Option>
          <Option value="oz">Ounces (oz)</Option>
          <Option value="ml">Milliliters (ml)</Option>
          <Option value="l">Liters (l)</Option>
          <Option value="gal">Gallons (gal)</Option>
          <Option value="gallon">Gallon</Option>
          <Option value="quart">Quart</Option>
          <Option value="g">Grams (g)</Option>
          <Option value="kg">Kilograms (kg)</Option>
          <Option value="lb">Pounds (lb)</Option>
        </Select>
      </Form.Item>

      <Form.Item label="Location" name="location">
        <Input placeholder="Storage location" />
      </Form.Item>

      {isNewPartMode && (
        <Form.Item label="Category" name="category">
          <Select placeholder="Select category" allowClear>
            <Option value="General">General</Option>
            <Option value="Sealant">Sealant</Option>
            <Option value="Paint">Paint</Option>
            <Option value="Adhesive">Adhesive</Option>
            <Option value="Solvent">Solvent</Option>
          </Select>
        </Form.Item>
      )}

      <Form.Item label="Status" name="status" initialValue="available">
        <Select>
          <Option value="available">Available</Option>
          <Option value="low_stock">Low Stock</Option>
          <Option value="out_of_stock">Out of Stock</Option>
          <Option value="expired">Expired</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Warehouse"
        name="warehouse_id"
        rules={[{ required: true, message: 'Warehouse is required' }]}
      >
        <Select
          placeholder="Select warehouse"
          loading={warehousesLoading}
          showSearch
          optionFilterProp="label"
          notFoundContent={warehousesLoading ? 'Loading...' : 'No warehouses found'}
          options={(warehousesData?.warehouses || []).map((w) => ({
            label: w.name,
            value: w.id,
          }))}
        />
      </Form.Item>

      <Form.Item label="Expiration Date" name="expiration_date">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>

      {isNewPartMode && (
        <Form.Item
          label="Minimum Stock Level"
          name="minimum_stock_level"
          extra="Threshold across all lots of this part. Reorder fires when on-hand falls to or below this number."
        >
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      )}

      <Form.Item label="Notes" name="notes">
        <TextArea rows={2} placeholder="Additional notes" />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing
              ? 'Update Chemical'
              : isExistingMode
                ? 'Add Lot'
                : 'Create Part & Lot'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
