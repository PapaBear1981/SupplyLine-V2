import React, { useState } from 'react';
import { Table, Button, Input, Select, Space, Tag, Modal, message, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MasterChemical, MasterChemicalFormData } from '../types';
import { MasterChemicalForm } from '../components/MasterChemicalForm';
import { WarehouseSettingsModal } from '../components/WarehouseSettingsModal';

const { Search } = Input;
const { Option } = Select;

export const MasterChemicalsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedMasterChemical, setSelectedMasterChemical] = useState<MasterChemical | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [form] = Form.useForm();

  // Fetch master chemicals
  const fetchMasterChemicals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '50',
      });
      if (search) params.append('q', search);
      if (category) params.append('category', category);

      const response = await fetch(`/api/master-chemicals?${params}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      message.error('Failed to load master chemicals');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMasterChemicals();
  }, [page, search, category]);

  const handleSubmit = async (values: MasterChemicalFormData) => {
    setSubmitting(true);
    try {
      const url = selectedMasterChemical
        ? `/api/master-chemicals/${selectedMasterChemical.id}`
        : '/api/master-chemicals';

      const method = selectedMasterChemical ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success(`Master chemical ${selectedMasterChemical ? 'updated' : 'created'} successfully`);
        setIsFormOpen(false);
        setSelectedMasterChemical(null);
        form.resetFields();
        fetchMasterChemicals();
      } else {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${selectedMasterChemical ? 'update' : 'create'} master chemical`);
      }
    } catch (error: any) {
      message.error(error.message);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (masterChemical: MasterChemical) => {
    Modal.confirm({
      title: 'Deactivate Master Chemical?',
      content: `Are you sure you want to deactivate ${masterChemical.part_number}? This will prevent it from being used for new inventory.`,
      okText: 'Yes, deactivate',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await fetch(`/api/master-chemicals/${masterChemical.id}`, {
            method: 'DELETE',
          });
          if (response.ok) {
            message.success('Master chemical deactivated successfully');
            fetchMasterChemicals();
          } else {
            const error = await response.json();
            message.error(error.error || 'Failed to deactivate master chemical');
          }
        } catch (error) {
          message.error('Failed to deactivate master chemical');
        }
      },
    });
  };

  const columns: ColumnsType<MasterChemical> = [
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      sorter: true,
      width: 150,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Manufacturer',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 150,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
    },
    {
      title: 'Shelf Life',
      dataIndex: 'shelf_life_days',
      key: 'shelf_life_days',
      width: 120,
      render: (days: number | null) => (days ? `${days} days` : 'N/A'),
    },
    {
      title: 'Active Lots',
      dataIndex: 'active_lots_count',
      key: 'active_lots_count',
      width: 100,
      render: (count: number) => <Tag color={count > 0 ? 'green' : 'default'}>{count}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedMasterChemical(record);
              setIsFormOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => {
              setSelectedMasterChemical(record);
              setIsSettingsOpen(true);
            }}
          >
            Settings
          </Button>
          <Button
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record)}
            disabled={(record.active_lots_count ?? 0) > 0}
            title={(record.active_lots_count ?? 0) > 0 ? 'Cannot delete - has active inventory lots' : ''}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Master Chemicals</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setSelectedMasterChemical(null);
            form.resetFields();
            setIsFormOpen(true);
          }}
        >
          Add Master Chemical
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Search
          placeholder="Search part number, description..."
          onSearch={setSearch}
          style={{ width: 300 }}
          allowClear
        />
        <Select
          placeholder="Filter by category"
          allowClear
          onChange={setCategory}
          style={{ width: 200 }}
          value={category}
        >
          <Option value="General">General</Option>
          <Option value="Sealant">Sealant</Option>
          <Option value="Paint">Paint</Option>
          <Option value="Adhesive">Adhesive</Option>
          <Option value="Solvent">Solvent</Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={data?.master_chemicals || []}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          onChange: setPage,
          total: data?.pagination?.total || 0,
          pageSize: data?.pagination?.per_page || 50,
          showSizeChanger: false,
        }}
      />

      <Modal
        open={isFormOpen}
        title={selectedMasterChemical ? 'Edit Master Chemical' : 'Add Master Chemical'}
        onCancel={() => {
          setIsFormOpen(false);
          setSelectedMasterChemical(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <MasterChemicalForm
          form={form}
          initialValues={selectedMasterChemical}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setSelectedMasterChemical(null);
            form.resetFields();
          }}
          loading={submitting}
        />
      </Modal>

      <WarehouseSettingsModal
        open={isSettingsOpen}
        masterChemical={selectedMasterChemical}
        onClose={() => {
          setIsSettingsOpen(false);
          setSelectedMasterChemical(null);
        }}
      />
    </div>
  );
};
