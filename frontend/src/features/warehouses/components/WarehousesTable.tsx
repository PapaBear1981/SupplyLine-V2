import { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Tooltip,
  Popconfirm,
  message,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useDeleteWarehouseMutation,
  useGetWarehousesQuery,
} from '../services/warehousesApi';
import type { Warehouse, WarehouseType } from '../types';

const { Text } = Typography;

interface WarehousesTableProps {
  onView: (warehouse: Warehouse) => void;
  onEdit: (warehouse: Warehouse) => void;
}

export const WarehousesTable = ({ onView, onEdit }: WarehousesTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data, isLoading, isFetching } = useGetWarehousesQuery({
    page,
    per_page: pageSize,
    include_inactive: includeInactive,
  });

  const [deleteWarehouse] = useDeleteWarehouseMutation();

  const handleDelete = async (id: number) => {
    try {
      await deleteWarehouse(id).unwrap();
      message.success('Warehouse deleted successfully');
    } catch {
      message.error('Failed to delete warehouse');
    }
  };

  const getTypeColor = (type: WarehouseType): string => {
    return type === 'main' ? 'blue' : 'green';
  };

  const columns: TableProps<Warehouse>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {!record.is_active && <Tag color="default">Inactive</Tag>}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'warehouse_type',
      key: 'warehouse_type',
      width: 120,
      render: (type: WarehouseType) => (
        <Tag color={getTypeColor(type)}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Tag>
      ),
      filters: [
        { text: 'Main', value: 'main' },
        { text: 'Satellite', value: 'satellite' },
      ],
      onFilter: (value, record) => record.warehouse_type === value,
    },
    {
      title: 'Location',
      key: 'location',
      width: 250,
      render: (_text, record) => {
        const parts = [
          record.city,
          record.state,
          record.zip_code,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : '—';
      },
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (text) => text || '—',
    },
    {
      title: 'Contact Person',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 180,
      render: (text) => text || '—',
    },
    {
      title: 'Contact Phone',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      width: 150,
      render: (text) => text || '—',
    },
    {
      title: 'Inventory',
      key: 'inventory',
      width: 140,
      render: (_text, record) => (
        <Space direction="vertical" size={0}>
          {record.tools_count !== undefined && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tools: {record.tools_count}
            </Text>
          )}
          {record.chemicals_count !== undefined && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Chemicals: {record.chemicals_count}
            </Text>
          )}
          {record.expendables_count !== undefined && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Expendables: {record.expendables_count}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag
          icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={isActive ? 'success' : 'default'}
        >
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.is_active === value,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (date) => (date ? dayjs(date).format('MMM D, YYYY') : '—'),
      sorter: (a, b) =>
        dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 170,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button type="text" icon={<EyeOutlined />} onClick={() => onView(record)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete warehouse?"
            description="This action cannot be undone. All items in this warehouse should be transferred first."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input
          placeholder="Search warehouses..."
          prefix={<SearchOutlined />}
          style={{ maxWidth: 400 }}
          allowClear
          disabled
        />
        <Button
          type={includeInactive ? 'primary' : 'default'}
          onClick={() => {
            setIncludeInactive(!includeInactive);
            setPage(1);
          }}
        >
          {includeInactive ? 'Hide Inactive' : 'Show Inactive'}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data?.warehouses || []}
        rowKey="id"
        loading={isLoading || isFetching}
        scroll={{ x: 1400 }}
        pagination={{
          current: page,
          pageSize,
          total: data?.pagination.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} warehouses`,
          pageSizeOptions: ['10', '25', '50', '100'],
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          },
        }}
      />
    </div>
  );
};
