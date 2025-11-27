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
  Badge,
} from 'antd';
import type { TableProps } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useDeleteChemicalMutation,
  useGetChemicalsQuery,
} from '../services/chemicalsApi';
import type { Chemical, ChemicalStatus } from '../types';

const { Text } = Typography;

interface ChemicalsTableProps {
  onView: (chemical: Chemical) => void;
  onEdit: (chemical: Chemical) => void;
}

export const ChemicalsTable = ({ onView, onEdit }: ChemicalsTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, isFetching } = useGetChemicalsQuery({
    page,
    per_page: pageSize,
    q: searchQuery || undefined,
  });

  const [deleteChemical] = useDeleteChemicalMutation();

  const handleDelete = async (id: number) => {
    try {
      await deleteChemical(id).unwrap();
      message.success('Chemical deleted successfully');
    } catch {
      message.error('Failed to delete chemical');
    }
  };

  const getStatusColor = (status: ChemicalStatus): string => {
    const colors: Record<ChemicalStatus, string> = {
      available: 'green',
      low_stock: 'orange',
      out_of_stock: 'red',
      expired: 'volcano',
      issued: 'blue',
    };
    return colors[status] || 'default';
  };

  const columns: TableProps<Chemical>['columns'] = [
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      fixed: 'left',
      width: 140,
      sorter: (a, b) => a.part_number.localeCompare(b.part_number),
      render: (text, record) => (
        <Space size={6}>
          <Text strong>{text}</Text>
          {record.expiring_soon && <Tag color="orange">Expiring Soon</Tag>}
          {record.is_archived && <Tag color="default">Archived</Tag>}
        </Space>
      ),
    },
    {
      title: 'Lot Number',
      dataIndex: 'lot_number',
      key: 'lot_number',
      width: 140,
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
      width: 160,
      render: (text) => text || '—',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (_text, record) => (
        <Space size={4}>
          <Text strong>{record.quantity}</Text>
          <Text type="secondary">{record.unit}</Text>
        </Space>
      ),
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: ChemicalStatus, record) => (
        <Space size={4}>
          <Tag color={getStatusColor(status)}>
            {status.replaceAll('_', ' ').toUpperCase()}
          </Tag>
          {record.minimum_stock_level !== null && record.minimum_stock_level !== undefined && (
            <Tooltip title={`Minimum stock: ${record.minimum_stock_level}`}>
              <Badge status="processing" />
            </Tooltip>
          )}
        </Space>
      ),
      filters: [
        { text: 'Available', value: 'available' },
        { text: 'Low Stock', value: 'low_stock' },
        { text: 'Out of Stock', value: 'out_of_stock' },
        { text: 'Expired', value: 'expired' },
        { text: 'Issued', value: 'issued' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Expiration',
      dataIndex: 'expiration_date',
      key: 'expiration_date',
      width: 140,
      render: (date) => (date ? dayjs(date).format('MMM D, YYYY') : '—'),
      sorter: (a, b) =>
        (a.expiration_date ? dayjs(a.expiration_date).valueOf() : 0) -
        (b.expiration_date ? dayjs(b.expiration_date).valueOf() : 0),
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 160,
      render: (_text, record) => record.warehouse_name || record.warehouse_id || '—',
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
            title="Delete chemical?"
            description="This action cannot be undone."
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
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search chemicals..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPressEnter={() => setPage(1)}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={data?.chemicals || []}
        rowKey="id"
        loading={isLoading || isFetching}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total: data?.pagination.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} chemicals`,
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
