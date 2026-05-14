import { useState } from 'react';
import {
  Alert,
  Table,
  Button,
  Space,
  Switch,
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
  ExportOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useDeleteChemicalMutation,
  useGetChemicalPartsQuery,
} from '../services/chemicalsApi';
import type { Chemical, ChemicalPart, ChemicalPartStatus } from '../types';
import { PermissionGuard } from '@features/auth/components/PermissionGuard';
import { useFeatures } from '@features/auth/hooks/useFeatures';
import { useActiveWarehouse } from '@features/warehouses/hooks/useActiveWarehouse';

const { Text } = Typography;

interface ChemicalPartsTableProps {
  onView: (chemical: Chemical) => void;
  onEdit: (chemical: Chemical) => void;
  onIssue: (chemical: Chemical) => void;
}

const PART_STATUS_COLOR: Record<ChemicalPartStatus, string> = {
  available: 'green',
  low_stock: 'orange',
  out_of_stock: 'red',
};

export const ChemicalPartsTable = ({
  onView,
  onEdit,
  onIssue,
}: ChemicalPartsTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [showAllWarehouses, setShowAllWarehouses] = useState(false);

  const { activeWarehouseId, activeWarehouseName } = useActiveWarehouse();
  const features = useFeatures();

  const { data, isLoading, isFetching } = useGetChemicalPartsQuery({
    page,
    per_page: pageSize,
    q: committedSearch || undefined,
    warehouse_id:
      !showAllWarehouses && activeWarehouseId ? activeWarehouseId : undefined,
  });

  const [deleteChemical] = useDeleteChemicalMutation();

  const handleDeleteLot = async (id: number) => {
    try {
      await deleteChemical(id).unwrap();
      message.success('Lot deleted successfully');
    } catch {
      message.error('Failed to delete lot');
    }
  };

  const partColumns: TableProps<ChemicalPart>['columns'] = [
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      fixed: 'left',
      width: 180,
      sorter: (a, b) => a.part_number.localeCompare(b.part_number),
      render: (text, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{text}</Text>
          {features.chemicalReorder && record.has_open_reorder_request && (
            <Tag color="blue">Reorder Open</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '—',
    },
    {
      title: 'Manufacturer',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 160,
      render: (text) => text || '—',
    },
    {
      title: 'Lots',
      dataIndex: 'lot_count',
      key: 'lot_count',
      width: 90,
      align: 'center',
      render: (count: number) => <Badge count={count} showZero color="#999" />,
      sorter: (a, b) => a.lot_count - b.lot_count,
    },
    {
      title: 'On Hand',
      key: 'total_active_quantity',
      width: 140,
      render: (_text, record) => (
        <Space size={4}>
          <Text strong>{record.total_active_quantity}</Text>
          <Text type="secondary">{record.default_unit}</Text>
        </Space>
      ),
      sorter: (a, b) => a.total_active_quantity - b.total_active_quantity,
    },
    {
      title: 'Min Stock',
      dataIndex: 'minimum_stock_level',
      key: 'minimum_stock_level',
      width: 110,
      render: (val: number | null | undefined) =>
        val !== null && val !== undefined ? val : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: ChemicalPartStatus) => (
        <Tag color={PART_STATUS_COLOR[status] || 'default'}>
          {status.replaceAll('_', ' ').toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Available', value: 'available' },
        { text: 'Low Stock', value: 'low_stock' },
        { text: 'Out of Stock', value: 'out_of_stock' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Earliest Expiry',
      dataIndex: 'earliest_expiration_date',
      key: 'earliest_expiration_date',
      width: 150,
      render: (date) => (date ? dayjs(date).format('MMM D, YYYY') : '—'),
      sorter: (a, b) =>
        (a.earliest_expiration_date
          ? dayjs(a.earliest_expiration_date).valueOf()
          : 0) -
        (b.earliest_expiration_date
          ? dayjs(b.earliest_expiration_date).valueOf()
          : 0),
    },
  ];

  const lotColumns: TableProps<Chemical>['columns'] = [
    {
      title: 'Lot Number',
      dataIndex: 'lot_number',
      key: 'lot_number',
      width: 180,
      render: (text, record) => (
        <Space direction="vertical" size={2}>
          <Text>{text}</Text>
          {record.expiring_soon && <Tag color="orange">Expiring Soon</Tag>}
        </Space>
      ),
    },
    {
      title: 'Quantity',
      key: 'quantity',
      width: 120,
      render: (_text, record) => (
        <Space size={4}>
          <Text strong>{record.quantity}</Text>
          <Text type="secondary">{record.unit}</Text>
        </Space>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 180,
      render: (text) => text || '—',
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 160,
      render: (text) => text || '—',
    },
    {
      title: 'Expiration',
      dataIndex: 'expiration_date',
      key: 'expiration_date',
      width: 140,
      render: (date) => (date ? dayjs(date).format('MMM D, YYYY') : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => {
        const canIssue = record.status !== 'expired' && record.quantity > 0;
        return (
          <Space size="small">
            <Tooltip title="View Details">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => onView(record)}
              />
            </Tooltip>
            <PermissionGuard permission="chemical.issue">
              <Tooltip
                title={canIssue ? 'Issue' : 'Cannot issue (expired or out of stock)'}
              >
                <Button
                  type="text"
                  icon={<ExportOutlined />}
                  onClick={() => onIssue(record)}
                  disabled={!canIssue}
                />
              </Tooltip>
            </PermissionGuard>
            <PermissionGuard permission="chemical.edit">
              <Tooltip title="Edit Lot">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => onEdit(record)}
                />
              </Tooltip>
            </PermissionGuard>
            <PermissionGuard permission="chemical.delete">
              <Popconfirm
                title="Delete lot?"
                description="This action cannot be undone."
                onConfirm={() => handleDeleteLot(record.id)}
                okText="Yes"
                cancelText="No"
                okButtonProps={{ danger: true }}
                icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
              >
                <Tooltip title="Delete">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </PermissionGuard>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <Input
          placeholder="Search by part number, description, manufacturer..."
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
          data-testid="chemical-parts-search-input"
        />
        {activeWarehouseId && (
          <Space>
            <span>All warehouses</span>
            <Switch
              size="small"
              checked={showAllWarehouses}
              onChange={(value) => {
                setShowAllWarehouses(value);
                setPage(1);
              }}
            />
          </Space>
        )}
      </div>
      {activeWarehouseId && showAllWarehouses && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Viewing chemical parts across all warehouses. Issue/return is only allowed for items in ${
            activeWarehouseName || 'your active warehouse'
          }.`}
        />
      )}

      <div data-testid="chemical-parts-table">
        <Table<ChemicalPart>
          columns={partColumns}
          dataSource={data?.parts || []}
          rowKey="id"
          loading={isLoading || isFetching}
          scroll={{ x: 1200 }}
          expandable={{
            expandedRowRender: (part) => (
              <Table<Chemical>
                columns={lotColumns}
                dataSource={part.lots}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 900 }}
                locale={{
                  emptyText: 'No active lots for this part number',
                }}
              />
            ),
            rowExpandable: (part) => part.lot_count > 0,
          }}
          pagination={{
            current: page,
            pageSize,
            total: data?.pagination.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} part numbers`,
            pageSizeOptions: ['10', '25', '50', '100'],
            onChange: (newPage, newPageSize) => {
              setPage(newPage);
              setPageSize(newPageSize);
            },
          }}
        />
      </div>
    </div>
  );
};
