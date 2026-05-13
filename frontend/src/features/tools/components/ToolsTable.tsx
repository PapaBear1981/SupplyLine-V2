import { useState } from 'react';
import {
  Alert,
  Button,
  Input,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  QrcodeOutlined,
  SearchOutlined,
  SendOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import {
  useGetToolsQuery,
  useDeleteToolMutation,
  useReturnToolFromFieldMutation,
} from '../services/toolsApi';
import { SendToFieldModal } from './SendToFieldModal';
import type {
  Tool,
  ToolStatus,
  CalibrationStatus,
  ToolsSortField,
  SortOrder,
} from '../types';
import { LabelPrintModal } from '@/components/shared/LabelPrintModal';
import { PermissionGuard } from '@features/auth/components/PermissionGuard';
import { useActiveWarehouse } from '@features/warehouses/hooks/useActiveWarehouse';

interface ToolsTableProps {
  onView: (tool: Tool) => void;
  onEdit: (tool: Tool) => void;
}

export const ToolsTable = ({ onView, onEdit }: ToolsTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [printModalTool, setPrintModalTool] = useState<{ id: number; description: string } | null>(null);
  const [sendToFieldTool, setSendToFieldTool] = useState<Tool | null>(null);
  const [showAllWarehouses, setShowAllWarehouses] = useState(false);
  const [sortBy, setSortBy] = useState<ToolsSortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder | undefined>(undefined);

  const { activeWarehouseId, activeWarehouseName } = useActiveWarehouse();

  const { data, isLoading, isFetching } = useGetToolsQuery({
    page,
    per_page: pageSize,
    q: searchQuery || undefined,
    warehouse_id:
      !showAllWarehouses && activeWarehouseId ? activeWarehouseId : undefined,
    sort_by: sortBy,
    order: sortOrder,
  });

  const sortOrderFor = (key: ToolsSortField) => {
    if (sortBy !== key || !sortOrder) return null;
    return sortOrder === 'asc' ? ('ascend' as const) : ('descend' as const);
  };

  const handleTableChange: NonNullable<TableProps<Tool>['onChange']> = (
    _pagination,
    _filters,
    sorter,
  ) => {
    const single = Array.isArray(sorter) ? sorter[0] : (sorter as SorterResult<Tool>);
    const nextSortBy = single?.order
      ? (single.columnKey as ToolsSortField)
      : undefined;
    const nextOrder: SortOrder | undefined = single?.order
      ? single.order === 'ascend' ? 'asc' : 'desc'
      : undefined;
    if (nextSortBy !== sortBy || nextOrder !== sortOrder) {
      setSortBy(nextSortBy);
      setSortOrder(nextOrder);
      setPage(1);
    }
  };

  const [deleteTool] = useDeleteToolMutation();
  const [returnFromField] = useReturnToolFromFieldMutation();

  const handleReturnFromField = async (tool: Tool) => {
    try {
      await returnFromField({ toolId: tool.id }).unwrap();
      message.success(`Tool ${tool.tool_number} returned from field`);
    } catch (err) {
      const e = err as { data?: { error?: string } };
      message.error(e?.data?.error || 'Failed to return tool from field');
    }
  };

  // A tool is "in the field" when its location starts with "Kit:" — that's the
  // marker the send-to-field flow sets when a KitToolCheckout is created.
  const isInField = (tool: Tool) =>
    typeof tool.location === 'string' && tool.location.startsWith('Kit:');

  const handleDelete = async (id: number) => {
    try {
      await deleteTool(id).unwrap();
      message.success('Tool deleted successfully');
    } catch {
      message.error('Failed to delete tool');
    }
  };

  const getStatusColor = (status: ToolStatus): string => {
    const colors: Record<ToolStatus, string> = {
      available: 'green',
      checked_out: 'blue',
      maintenance: 'orange',
      retired: 'red',
      in_transfer: 'purple',
    };
    return colors[status] || 'default';
  };

  const getCalibrationStatusColor = (status: CalibrationStatus): string => {
    const colors: Record<CalibrationStatus, string> = {
      current: 'green',
      due_soon: 'orange',
      overdue: 'red',
      not_applicable: 'default',
    };
    return colors[status] || 'default';
  };

  const columns: TableProps<Tool>['columns'] = [
    {
      title: 'Tool Number',
      dataIndex: 'tool_number',
      key: 'tool_number',
      fixed: 'left',
      width: 150,
      sorter: true,
      sortOrder: sortOrderFor('tool_number'),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: true,
      sortOrder: sortOrderFor('description'),
    },
    {
      title: 'Serial Number',
      dataIndex: 'serial_number',
      key: 'serial_number',
      width: 150,
      sorter: true,
      sortOrder: sortOrderFor('serial_number'),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      filters: [
        { text: 'General', value: 'General' },
        { text: 'Precision', value: 'Precision' },
        { text: 'Power Tools', value: 'Power Tools' },
      ],
      onFilter: (value, record) => record.category === value,
      sorter: true,
      sortOrder: sortOrderFor('category'),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 150,
      sorter: true,
      sortOrder: sortOrderFor('location'),
    },
    {
      title: 'Field Location',
      key: 'field_location',
      width: 160,
      render: (_, record) =>
        isInField(record) ? (
          <Tag color="blue" data-testid="tool-field-location">
            {record.location?.replace(/^Kit:\s*/, '')}
          </Tag>
        ) : (
          <span style={{ color: '#999' }}>—</span>
        ),
    },
    ...(showAllWarehouses
      ? [{
          title: 'Warehouse',
          dataIndex: 'warehouse_name',
          key: 'warehouse_name',
          width: 160,
          render: (_: unknown, record: Tool) => record.warehouse_name || '—',
          sorter: true,
          sortOrder: sortOrderFor('warehouse_name'),
        }]
      : []),
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: ToolStatus, record) => (
        <Tooltip title={record.status_reason || undefined}>
          <Tag color={getStatusColor(status)}>
            {status.replace('_', ' ').toUpperCase()}
          </Tag>
        </Tooltip>
      ),
      filters: [
        { text: 'Available', value: 'available' },
        { text: 'Checked Out', value: 'checked_out' },
        { text: 'In Transfer', value: 'in_transfer' },
        { text: 'Maintenance', value: 'maintenance' },
        { text: 'Retired', value: 'retired' },
      ],
      onFilter: (value, record) => record.status === value,
      sorter: true,
      sortOrder: sortOrderFor('status'),
    },
    {
      title: 'Calibration',
      dataIndex: 'calibration_status',
      key: 'calibration_status',
      width: 130,
      sorter: true,
      sortOrder: sortOrderFor('calibration_status'),
      render: (status: CalibrationStatus | null | undefined, record) => {
        if (!record.requires_calibration) {
          return <Tag color="default">N/A</Tag>;
        }
        if (!status) {
          // Tool requires calibration but no status has been computed yet
          // (e.g., never calibrated). Don't crash the row.
          return <Tag color="default">UNKNOWN</Tag>;
        }
        return (
          <Tag color={getCalibrationStatusColor(status)}>
            {status.replace('_', ' ').toUpperCase()}
          </Tag>
        );
      },
      filters: [
        { text: 'Current', value: 'current' },
        { text: 'Due Soon', value: 'due_soon' },
        { text: 'Overdue', value: 'overdue' },
      ],
      onFilter: (value, record) => record.calibration_status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 240,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => onView(record)}
            />
          </Tooltip>
          <PermissionGuard permission="tool.edit">
            <Tooltip title="Edit">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => onEdit(record)}
              />
            </Tooltip>
          </PermissionGuard>
          {isInField(record) ? (
            <Popconfirm
              title="Return from field?"
              description="This will close the active field deployment."
              onConfirm={() => handleReturnFromField(record)}
              okText="Return"
              cancelText="Cancel"
            >
              <Tooltip title="Return from Field">
                <Button
                  type="text"
                  icon={<RollbackOutlined />}
                  data-testid="tool-return-from-field-button"
                />
              </Tooltip>
            </Popconfirm>
          ) : (
            <Tooltip title="Send to Field">
              <Button
                type="text"
                icon={<SendOutlined />}
                onClick={() => setSendToFieldTool(record)}
                disabled={record.status !== 'available'}
                data-testid="tool-send-to-field-button"
              />
            </Tooltip>
          )}
          <Tooltip title="Print Label">
            <Button
              type="text"
              icon={<QrcodeOutlined />}
              onClick={() => setPrintModalTool({ id: record.id, description: record.tool_number || record.description || '' })}
            />
          </Tooltip>
          <PermissionGuard permission="tool.delete">
            <Popconfirm
              title="Delete tool?"
              description="This action cannot be undone."
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
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
          placeholder="Search tools..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPressEnter={() => setPage(1)}
          style={{ maxWidth: 400 }}
          allowClear
          data-testid="tools-search-input"
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
          message={`Viewing tools across all warehouses. Check-in/out is only allowed for items in ${activeWarehouseName || 'your active warehouse'}.`}
        />
      )}

      <div data-testid="tools-table">
        <Table
          columns={columns}
          dataSource={data?.tools || []}
          rowKey="id"
          loading={isLoading || isFetching}
          scroll={{ x: 1200 }}
          onChange={handleTableChange}
          pagination={{
            current: page,
            pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} tools`,
            pageSizeOptions: ['10', '25', '50', '100'],
            onChange: (newPage, newPageSize) => {
              setPage(newPage);
              setPageSize(newPageSize);
            },
          }}
        />
      </div>

      {printModalTool && (
        <LabelPrintModal
          open={true}
          onClose={() => setPrintModalTool(null)}
          itemType="tool"
          itemId={printModalTool.id}
          itemDescription={printModalTool.description}
        />
      )}

      <SendToFieldModal
        open={sendToFieldTool !== null}
        tool={sendToFieldTool}
        onClose={() => setSendToFieldTool(null)}
      />
    </div>
  );
};
