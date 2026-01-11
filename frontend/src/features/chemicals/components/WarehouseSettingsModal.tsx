import React, { useEffect, useState } from 'react';
import { Modal, Table, Button, Form, InputNumber, Input, Space, message, Popconfirm, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MasterChemical, ChemicalWarehouseSetting, ChemicalWarehouseSettingFormData } from '../types';

const { TextArea } = Input;
const { Option } = Select;

interface WarehouseSettingsModalProps {
  open: boolean;
  masterChemical: MasterChemical | null;
  onClose: () => void;
}

export const WarehouseSettingsModal: React.FC<WarehouseSettingsModalProps> = ({
  open,
  masterChemical,
  onClose,
}) => {
  const [settings, setSettings] = useState<ChemicalWarehouseSetting[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingSetting, setEditingSetting] = useState<ChemicalWarehouseSetting | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && masterChemical) {
      fetchSettings();
      fetchWarehouses();
    }
  }, [open, masterChemical]);

  const fetchSettings = async () => {
    if (!masterChemical) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/master-chemicals/${masterChemical.id}/warehouse-settings`);
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      message.error('Failed to load warehouse settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses?per_page=100');
      const data = await response.json();
      setWarehouses(data.warehouses || []);
    } catch (error) {
      message.error('Failed to load warehouses');
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setEditingSetting(null);
    setIsFormVisible(true);
  };

  const handleEdit = (setting: ChemicalWarehouseSetting) => {
    form.setFieldsValue({
      warehouse_id: setting.warehouse_id,
      minimum_stock_level: setting.minimum_stock_level,
      maximum_stock_level: setting.maximum_stock_level,
      preferred_location: setting.preferred_location,
      notes: setting.notes,
    });
    setEditingSetting(setting);
    setIsFormVisible(true);
  };

  const handleDelete = async (setting: ChemicalWarehouseSetting) => {
    if (!masterChemical) return;
    try {
      const response = await fetch(
        `/api/master-chemicals/${masterChemical.id}/warehouse-settings/${setting.id}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        message.success('Warehouse setting deleted successfully');
        fetchSettings();
      } else {
        const error = await response.json();
        message.error(error.error || 'Failed to delete warehouse setting');
      }
    } catch (error) {
      message.error('Failed to delete warehouse setting');
    }
  };

  const handleSubmit = async (values: ChemicalWarehouseSettingFormData) => {
    if (!masterChemical) return;

    try {
      const url = editingSetting
        ? `/api/master-chemicals/${masterChemical.id}/warehouse-settings/${editingSetting.id}`
        : `/api/master-chemicals/${masterChemical.id}/warehouse-settings`;

      const method = editingSetting ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success(`Warehouse setting ${editingSetting ? 'updated' : 'created'} successfully`);
        setIsFormVisible(false);
        form.resetFields();
        fetchSettings();
      } else {
        const error = await response.json();
        message.error(error.error || `Failed to ${editingSetting ? 'update' : 'create'} warehouse setting`);
      }
    } catch (error) {
      message.error(`Failed to ${editingSetting ? 'update' : 'create'} warehouse setting`);
    }
  };

  const columns: ColumnsType<ChemicalWarehouseSetting> = [
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
    },
    {
      title: 'Min Stock',
      dataIndex: 'minimum_stock_level',
      key: 'minimum_stock_level',
      render: (value: number | null) => value ?? 'Not set',
    },
    {
      title: 'Max Stock',
      dataIndex: 'maximum_stock_level',
      key: 'maximum_stock_level',
      render: (value: number | null) => value ?? 'Not set',
    },
    {
      title: 'Preferred Location',
      dataIndex: 'preferred_location',
      key: 'preferred_location',
      render: (value: string | null) => value || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this warehouse setting?"
            onConfirm={() => handleDelete(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Get available warehouses (not already configured)
  const availableWarehouses = warehouses.filter(
    (wh) => !settings.find((s) => s.warehouse_id === wh.id)
  );

  return (
    <Modal
      open={open}
      title={`Warehouse Settings - ${masterChemical?.part_number || ''}`}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Warehouse Setting
        </Button>,
      ]}
    >
      <Table
        columns={columns}
        dataSource={settings}
        loading={loading}
        rowKey="id"
        pagination={false}
        size="small"
      />

      <Modal
        open={isFormVisible}
        title={editingSetting ? 'Edit Warehouse Setting' : 'Add Warehouse Setting'}
        onCancel={() => {
          setIsFormVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Warehouse"
            name="warehouse_id"
            rules={[{ required: true, message: 'Please select warehouse' }]}
          >
            <Select
              placeholder="Select warehouse"
              disabled={!!editingSetting}
              showSearch
              optionFilterProp="children"
            >
              {(editingSetting ? warehouses : availableWarehouses).map((wh) => (
                <Option key={wh.id} value={wh.id}>
                  {wh.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Minimum Stock Level"
            name="minimum_stock_level"
            help="Reorder alert triggers when total stock falls below this level"
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g., 5" />
          </Form.Item>

          <Form.Item
            label="Maximum Stock Level"
            name="maximum_stock_level"
            help="Target stock level for reorders"
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g., 20" />
          </Form.Item>

          <Form.Item
            label="Preferred Location"
            name="preferred_location"
            help="Default storage location in this warehouse"
          >
            <Input placeholder="e.g., Shelf A-12" maxLength={200} />
          </Form.Item>

          <Form.Item label="Notes" name="notes">
            <TextArea rows={2} placeholder="Additional notes" maxLength={1000} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingSetting ? 'Update' : 'Create'}
              </Button>
              <Button
                onClick={() => {
                  setIsFormVisible(false);
                  form.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
};
