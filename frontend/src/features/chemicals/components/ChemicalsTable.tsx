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
  SearchOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useDeleteChemicalMutation,
  useGetChemicalsQuery,
} from '../services/chemicalsApi';
import type { Chemical, ChemicalStatus } from '../types';

const { Text } = Typography;

interface ChemicalsTableProps {
  onRowClick: (chemical: Chemical) => void;
  onEdit: (chemical: Chemical) => void;
  onIssue: (chemical: Chemical) => void;
  category?: string;
  status?: ChemicalStatus;
  warehouseId?: number;
  showArchived?: boolean;
}

export const ChemicalsTable = ({
  onRowClick,
  onEdit,
  onIssue,
  category,
  status,
  warehouseId,
  showArchived,
}: ChemicalsTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');

  const { data, isLoading, isFetching } = useGetChemicalsQuery({
    page,
    per_page: pageSize,
    q: committedSearch || undefined,
    category,
    status,
    warehouse_id: warehouseId,
    archived: showArchived,
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
      title: 'Kit / Box',
      key: 'kit_location',
      width: 180,
      render: (_text, record) => {
        if (record.kit_name) {
          const boxInfo = record.box_number ? ` / Box ${record.box_number}` : '';
          return (
            <Space direction="vertical" size={0}>
              <Text strong>{record.kit_name}</Text>
              {boxInfo && <Text type="secondary" style={{ fontSize: '12px' }}>{boxInfo}</Text>}
            </Space>
          );
        }
        return '—';
      },
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 140,
      render: (_text, record) => record.warehouse_name || record.warehouse_id || '—',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 120,
      render: (location, record) => {
        if (!location) return '—';
        return (
          <Tooltip title={`${record.warehouse_name || 'Warehouse'}: ${location}`}>
            <Text>{location}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 200,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (category) => category || '—',
      filters: [
        { text: 'Adhesive', value: 'Adhesive' },
        { text: 'Cleaner', value: 'Cleaner' },
        { text: 'Coating', value: 'Coating' },
        { text: 'Lubricant', value: 'Lubricant' },
        { text: 'Paint', value: 'Paint' },
        { text: 'Sealant', value: 'Sealant' },
        { text: 'Solvent', value: 'Solvent' },
        { text: 'Other', value: 'Other' },
      ],
      onFilter: (value, record) => record.category === value,
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
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, record) => {
        const canIssue = record.status !== 'expired' && record.quantity > 0;
        return (
          <Space size="small">
            <Tooltip title={canIssue ? 'Issue' : 'Cannot issue (expired or out of stock)'}>
              <Button
                type="text"
                icon={<ExportOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onIssue(record);
                }}
                disabled={!canIssue}
              />
            </Tooltip>
            <Tooltip title="Edit">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(record);
                }}
              />
            </Tooltip>
            <Popconfirm
              title="Delete chemical?"
              description="This action cannot be undone."
              onConfirm={() => handleDelete(record.id)}
              onCancel={(e) => e?.stopPropagation()}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            >
              <Tooltip title="Delete">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
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
          onPressEnter={() => {
            setCommittedSearch(searchQuery);
            setPage(1);
          }}
          style={{ maxWidth: 400 }}
          allowClear
          onClear={() => {
            setSearchQuery('');
            setCommittedSearch('');
            setPage(1);
          }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={data?.chemicals || []}
        rowKey="id"
        loading={isLoading || isFetching}
        scroll={{ x: 1200 }}
        onRow={(record) => ({
          onClick: () => onRowClick(record),
          style: { cursor: 'pointer' },
        })}
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
