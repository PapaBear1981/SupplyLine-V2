import { useEffect, useCallback, useState } from 'react';
import { Form, Input, InputNumber, Select, DatePicker, Button, Space, Alert, Tag } from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import type { Chemical, ChemicalFormData, MasterChemical } from '../types';

const { TextArea } = Input;
const { Option } = Select;

interface ChemicalFormProps {
  form: FormInstance;
  initialValues?: Chemical | null;
  onSubmit: (values: ChemicalFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ChemicalForm = ({ form, initialValues, onSubmit, onCancel, loading }: ChemicalFormProps) => {
  const isEditing = !!initialValues;
  const [masterChemicals, setMasterChemicals] = useState<MasterChemical[]>([]);
  const [selectedMasterChemical, setSelectedMasterChemical] = useState<MasterChemical | null>(null);
  const [calculatedExpiration, setCalculatedExpiration] = useState<dayjs.Dayjs | null>(null);
  const [manualExpirationOverride, setManualExpirationOverride] = useState(false);
  const [loadingMasterChemicals, setLoadingMasterChemicals] = useState(false);

  // Fetch master chemicals on mount
  useEffect(() => {
    fetchMasterChemicals();
  }, []);

  const fetchMasterChemicals = async () => {
    setLoadingMasterChemicals(true);
    try {
      const response = await fetch('/api/master-chemicals?per_page=1000&include_inactive=false');
      const data = await response.json();
      setMasterChemicals(data.master_chemicals || []);
    } catch (error) {
      console.error('Failed to fetch master chemicals:', error);
    } finally {
      setLoadingMasterChemicals(false);
    }
  };

  const getInitialFormValues = useCallback(() => {
    if (!initialValues) return {};

    return {
      master_chemical_id: initialValues.master_chemical_id || undefined,
      lot_number: initialValues.lot_number,
      quantity: initialValues.quantity,
      warehouse_id: initialValues.warehouse_id || undefined,
      location: initialValues.location || undefined,
      manufacture_date: initialValues.manufacture_date
        ? dayjs(initialValues.manufacture_date)
        : undefined,
      received_date: initialValues.received_date
        ? dayjs(initialValues.received_date)
        : undefined,
      expiration_date: initialValues.expiration_date
        ? dayjs(initialValues.expiration_date)
        : undefined,
      notes: initialValues.notes || undefined,
    };
  }, [initialValues]);

  // Update form when initialValues change
  useEffect(() => {
    const values = getInitialFormValues();
    form.setFieldsValue(values);

    // If editing, load the master chemical
    if (initialValues?.master_chemical_id) {
      const mc = masterChemicals.find((m) => m.id === initialValues.master_chemical_id);
      if (mc) {
        setSelectedMasterChemical(mc);
      }
      // Check if expiration was overridden
      if (initialValues.expiration_date_override) {
        setManualExpirationOverride(true);
      }
    }
  }, [initialValues, form, getInitialFormValues, masterChemicals]);

  const handleMasterChemicalChange = (masterChemicalId: number) => {
    const mc = masterChemicals.find((m) => m.id === masterChemicalId);
    setSelectedMasterChemical(mc || null);

    if (mc) {
      // Reset manual override when selecting new master chemical
      setManualExpirationOverride(false);
      // Calculate expiration
      calculateExpirationDate(mc);
    }
  };

  const calculateExpirationDate = (mc: MasterChemical, manufactureDate?: dayjs.Dayjs) => {
    if (!mc.shelf_life_days) {
      setCalculatedExpiration(null);
      return;
    }

    const mfgDate = manufactureDate || form.getFieldValue('manufacture_date') || dayjs();
    const expiration = mfgDate.add(mc.shelf_life_days, 'day');
    setCalculatedExpiration(expiration);

    // Auto-fill if not manually overridden
    if (!manualExpirationOverride) {
      form.setFieldsValue({ expiration_date: expiration });
    }
  };

  const handleManufactureDateChange = (date: dayjs.Dayjs | null) => {
    if (selectedMasterChemical && date) {
      calculateExpirationDate(selectedMasterChemical, date);
    }
  };

  const handleExpirationDateChange = () => {
    // User manually changed expiration date
    setManualExpirationOverride(true);
  };

  const handleFinish = (values: any) => {
    const formData: ChemicalFormData = {
      master_chemical_id: values.master_chemical_id,
      lot_number: values.lot_number,
      quantity: values.quantity,
      warehouse_id: values.warehouse_id,
      location: values.location,
      manufacture_date: values.manufacture_date ? values.manufacture_date.toISOString() : undefined,
      received_date: values.received_date ? values.received_date.toISOString() : undefined,
      expiration_date: values.expiration_date ? values.expiration_date.toISOString() : undefined,
      notes: values.notes,
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
        label="Chemical"
        name="master_chemical_id"
        rules={[{ required: true, message: 'Please select a chemical from the master list' }]}
      >
        <Select
          showSearch
          placeholder="Select chemical from master list"
          optionFilterProp="children"
          onChange={handleMasterChemicalChange}
          loading={loadingMasterChemicals}
          disabled={isEditing}
          filterOption={(input, option) => {
            const children = option?.children as React.ReactNode;
            const childrenStr = String(children);
            return childrenStr.toLowerCase().includes(input.toLowerCase());
          }}
        >
          {masterChemicals.map((mc) => (
            <Option key={mc.id} value={mc.id}>
              {mc.part_number} - {mc.description}
            </Option>
          ))}
        </Select>
      </Form.Item>

      {selectedMasterChemical && (
        <Alert
          message={
            <div>
              <strong>{selectedMasterChemical.part_number}</strong> - {selectedMasterChemical.description}
            </div>
          }
          description={
            <div style={{ fontSize: '12px' }}>
              <div>Manufacturer: {selectedMasterChemical.manufacturer || 'N/A'}</div>
              <div>Category: {selectedMasterChemical.category}</div>
              <div>Unit: {selectedMasterChemical.unit}</div>
              {selectedMasterChemical.shelf_life_days && (
                <div>Shelf Life: {selectedMasterChemical.shelf_life_days} days</div>
              )}
            </div>
          }
          type="info"
          style={{ marginBottom: 16 }}
        />
      )}

      <Form.Item
        label="Lot Number"
        name="lot_number"
        rules={[{ required: true, message: 'Please enter lot number' }]}
      >
        <Input placeholder="e.g., LOT-123" />
      </Form.Item>

      <Form.Item
        label="Quantity"
        name="quantity"
        rules={[{ required: true, message: 'Please enter quantity' }]}
      >
        <InputNumber style={{ width: '100%' }} min={0} />
      </Form.Item>

      <Form.Item
        label="Warehouse ID"
        name="warehouse_id"
        rules={[{ required: true, message: 'Warehouse is required' }]}
      >
        <InputNumber style={{ width: '100%' }} min={1} placeholder="Enter warehouse ID" />
      </Form.Item>

      <Form.Item label="Location" name="location">
        <Input placeholder="Storage location (e.g., Shelf A-12)" />
      </Form.Item>

      <Form.Item label="Manufacture Date" name="manufacture_date">
        <DatePicker
          style={{ width: '100%' }}
          onChange={handleManufactureDateChange}
          placeholder="Select manufacture date"
        />
      </Form.Item>

      <Form.Item label="Received Date" name="received_date">
        <DatePicker
          style={{ width: '100%' }}
          placeholder="Select received date"
        />
      </Form.Item>

      <Form.Item
        label={
          <span>
            Expiration Date
            {calculatedExpiration && !manualExpirationOverride && (
              <Tag color="blue" style={{ marginLeft: 8 }}>
                Auto-calculated
              </Tag>
            )}
            {manualExpirationOverride && (
              <Tag color="orange" style={{ marginLeft: 8 }}>
                Manual override
              </Tag>
            )}
          </span>
        }
        name="expiration_date"
      >
        <DatePicker
          style={{ width: '100%' }}
          onChange={handleExpirationDateChange}
          placeholder="Select expiration date"
        />
      </Form.Item>

      {calculatedExpiration && selectedMasterChemical?.shelf_life_days && (
        <Alert
          message={`Calculated expiration: ${calculatedExpiration.format('YYYY-MM-DD')} (${
            selectedMasterChemical.shelf_life_days
          } days from manufacture date)`}
          type="info"
          style={{ marginBottom: 16 }}
        />
      )}

      <Form.Item label="Notes" name="notes">
        <TextArea rows={2} placeholder="Additional notes" />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEditing ? 'Update Chemical' : 'Create Chemical Lot'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
