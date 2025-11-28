import { useEffect, useState } from 'react';
import { Drawer, Descriptions, Tag, Button, Space, Spin, message, Form, Typography } from 'antd';
import { EditOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useCreateWarehouseMutation,
  useGetWarehouseQuery,
  useUpdateWarehouseMutation,
} from '../services/warehousesApi';
import type { WarehouseFormData, WarehouseType } from '../types';
import { WarehouseForm } from './WarehouseForm';

const { Title } = Typography;

interface WarehouseDrawerProps {
  open: boolean;
  mode: 'view' | 'edit' | 'create';
  warehouseId?: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const WarehouseDrawer = ({
  open,
  mode: initialMode,
  warehouseId,
  onClose,
  onSuccess,
}: WarehouseDrawerProps) => {
  const [mode, setMode] = useState(initialMode);
  const [form] = Form.useForm();

  const { data: warehouse, isLoading } = useGetWarehouseQuery(warehouseId!, {
    skip: !warehouseId || initialMode === 'create',
  });

  const [updateWarehouse, { isLoading: isUpdating }] = useUpdateWarehouseMutation();
  const [createWarehouse, { isLoading: isCreating }] = useCreateWarehouseMutation();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (warehouse && mode === 'edit') {
      form.resetFields();
    }
  }, [warehouse, mode, form]);

  const handleSubmit = async (values: WarehouseFormData) => {
    try {
      if (mode === 'create') {
        await createWarehouse(values).unwrap();
        message.success('Warehouse created successfully');
      } else if (mode === 'edit' && warehouseId) {
        await updateWarehouse({ id: warehouseId, data: values }).unwrap();
        message.success('Warehouse updated successfully');
      }
      onSuccess?.();
      onClose();
    } catch {
      message.error(`Failed to ${mode === 'create' ? 'create' : 'update'} warehouse`);
    }
  };

  const handleCancel = () => {
    if (mode === 'edit') {
      setMode('view');
      form.resetFields();
    } else {
      onClose();
    }
  };

  const getTypeColor = (type: WarehouseType): string => {
    return type === 'main' ? 'blue' : 'green';
  };

  const renderDetails = () => {
    if (!warehouse) return null;

    return (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Name">
          <strong>{warehouse.name}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Type">
          <Tag color={getTypeColor(warehouse.warehouse_type)}>
            {warehouse.warehouse_type.charAt(0).toUpperCase() + warehouse.warehouse_type.slice(1)}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag
            icon={warehouse.is_active ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={warehouse.is_active ? 'success' : 'default'}
          >
            {warehouse.is_active ? 'Active' : 'Inactive'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Address">{warehouse.address || '—'}</Descriptions.Item>
        <Descriptions.Item label="City">{warehouse.city || '—'}</Descriptions.Item>
        <Descriptions.Item label="State">{warehouse.state || '—'}</Descriptions.Item>
        <Descriptions.Item label="ZIP Code">{warehouse.zip_code || '—'}</Descriptions.Item>
        <Descriptions.Item label="Country">{warehouse.country || '—'}</Descriptions.Item>
        <Descriptions.Item label="Contact Person">{warehouse.contact_person || '—'}</Descriptions.Item>
        <Descriptions.Item label="Contact Phone">{warehouse.contact_phone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Contact Email">{warehouse.contact_email || '—'}</Descriptions.Item>

        {(warehouse.tools_count !== undefined || warehouse.chemicals_count !== undefined || warehouse.expendables_count !== undefined) && (
          <>
            <Descriptions.Item label="Tools Count">
              {warehouse.tools_count ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="Chemicals Count">
              {warehouse.chemicals_count ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="Expendables Count">
              {warehouse.expendables_count ?? 0}
            </Descriptions.Item>
          </>
        )}

        <Descriptions.Item label="Created By">{warehouse.created_by || '—'}</Descriptions.Item>
        <Descriptions.Item label="Created">
          {dayjs(warehouse.created_at).format('MMM D, YYYY h:mm A')}
        </Descriptions.Item>
        <Descriptions.Item label="Last Updated">
          {dayjs(warehouse.updated_at).format('MMM D, YYYY h:mm A')}
        </Descriptions.Item>
      </Descriptions>
    );
  };

  const getTitle = () => {
    if (mode === 'create') return 'Create New Warehouse';
    if (mode === 'edit') return 'Edit Warehouse';
    return warehouse ? `Warehouse: ${warehouse.name}` : 'Warehouse Details';
  };

  const getExtraActions = () => {
    if (mode === 'view' && warehouse) {
      return (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => setMode('edit')}>
            Edit
          </Button>
        </Space>
      );
    }
    return null;
  };

  return (
    <Drawer
      title={getTitle()}
      placement="right"
      width={window.innerWidth < 768 ? '100%' : 640}
      onClose={onClose}
      open={open}
      extra={getExtraActions()}
      destroyOnClose
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Space direction="vertical" align="center">
            <Spin size="large" />
            <Title level={5} style={{ margin: 0 }}>
              Loading warehouse details...
            </Title>
          </Space>
        </div>
      ) : mode === 'view' && !warehouse ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Title level={5}>Warehouse not found</Title>
        </div>
      ) : mode === 'view' && warehouse ? (
        renderDetails()
      ) : (
        <WarehouseForm
          form={form}
          initialValues={mode === 'edit' ? warehouse : null}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={isUpdating || isCreating}
        />
      )}
    </Drawer>
  );
};
