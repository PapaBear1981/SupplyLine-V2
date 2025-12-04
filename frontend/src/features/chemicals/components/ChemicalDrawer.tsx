import { useEffect, useState } from 'react';
import { Drawer, Descriptions, Tag, Button, Space, Spin, message, Form, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useCreateChemicalMutation,
  useGetChemicalQuery,
  useUpdateChemicalMutation,
} from '../services/chemicalsApi';
import type { ChemicalFormData, ChemicalStatus } from '../types';
import { ChemicalForm } from './ChemicalForm';

const { Title } = Typography;

interface ChemicalDrawerProps {
  open: boolean;
  mode: 'view' | 'edit' | 'create';
  chemicalId?: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChemicalDrawer = ({
  open,
  mode: initialMode,
  chemicalId,
  onClose,
  onSuccess,
}: ChemicalDrawerProps) => {
  const [mode, setMode] = useState(initialMode);
  const [form] = Form.useForm();

  const { data: chemical, isLoading } = useGetChemicalQuery(chemicalId!, {
    skip: !chemicalId || initialMode === 'create',
  });

  const [updateChemical, { isLoading: isUpdating }] = useUpdateChemicalMutation();
  const [createChemical, { isLoading: isCreating }] = useCreateChemicalMutation();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (chemical && mode === 'edit') {
      form.resetFields();
    }
  }, [chemical, mode, form]);

  const handleSubmit = async (values: ChemicalFormData) => {
    try {
      if (mode === 'create') {
        await createChemical(values).unwrap();
        message.success('Chemical created successfully');
      } else if (mode === 'edit' && chemicalId) {
        await updateChemical({ id: chemicalId, data: values }).unwrap();
        message.success('Chemical updated successfully');
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      const errorMessage = (error as { data?: { error?: string } })?.data?.error
        || `Failed to ${mode === 'create' ? 'create' : 'update'} chemical`;
      message.error(errorMessage);
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

  const getStatusColor = (status: ChemicalStatus): string => {
    const colors: Record<ChemicalStatus, string> = {
      available: 'green',
      low_stock: 'orange',
      out_of_stock: 'red',
      expired: 'volcano',
    };
    return colors[status] || 'default';
  };

  const renderDetails = () => {
    if (!chemical) return null;

    return (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Part Number">
          <Space size={4}>
            <strong>{chemical.part_number}</strong>
            {chemical.expiring_soon && <Tag color="orange">Expiring Soon</Tag>}
            {chemical.is_archived && <Tag color="default">Archived</Tag>}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Lot Number">{chemical.lot_number}</Descriptions.Item>
        <Descriptions.Item label="Description">{chemical.description || '—'}</Descriptions.Item>
        <Descriptions.Item label="Manufacturer">{chemical.manufacturer || '—'}</Descriptions.Item>
        <Descriptions.Item label="Quantity">
          {chemical.quantity} {chemical.unit}
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={getStatusColor(chemical.status)}>
            {chemical.status.replaceAll('_', ' ').toUpperCase()}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Location">{chemical.location || '—'}</Descriptions.Item>
        <Descriptions.Item label="Category">{chemical.category || '—'}</Descriptions.Item>
        <Descriptions.Item label="Warehouse">{chemical.warehouse_name || chemical.warehouse_id || '—'}</Descriptions.Item>
        <Descriptions.Item label="Expiration Date">
          {chemical.expiration_date
            ? dayjs(chemical.expiration_date).format('MMM D, YYYY')
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Minimum Stock Level">
          {chemical.minimum_stock_level ?? '—'}
        </Descriptions.Item>
        {chemical.expected_delivery_date && (
          <Descriptions.Item label="Expected Delivery">
            {dayjs(chemical.expected_delivery_date).format('MMM D, YYYY')}
          </Descriptions.Item>
        )}
        {chemical.notes && (
          <Descriptions.Item label="Notes">{chemical.notes}</Descriptions.Item>
        )}
        <Descriptions.Item label="Created">
          {dayjs(chemical.date_added).format('MMM D, YYYY h:mm A')}
        </Descriptions.Item>
      </Descriptions>
    );
  };

  const getTitle = () => {
    if (mode === 'create') return 'Create New Chemical';
    if (mode === 'edit') return 'Edit Chemical';
    return chemical ? `Chemical: ${chemical.part_number}` : 'Chemical Details';
  };

  const getExtraActions = () => {
    if (mode === 'view' && chemical) {
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
              Loading chemical details...
            </Title>
          </Space>
        </div>
      ) : mode === 'view' && !chemical ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Title level={5}>Chemical not found</Title>
        </div>
      ) : mode === 'view' && chemical ? (
        renderDetails()
      ) : (
        <ChemicalForm
          form={form}
          initialValues={mode === 'edit' ? chemical : null}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={isUpdating || isCreating}
        />
      )}
    </Drawer>
  );
};
