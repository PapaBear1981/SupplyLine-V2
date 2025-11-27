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
} from 'antd';
import type { TableProps } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  QrcodeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useGetToolsQuery, useDeleteToolMutation } from '../services/toolsApi';
import type { Tool, ToolStatus, CalibrationStatus } from '../types';

interface ToolsTableProps {
  onView: (tool: Tool) => void;
  onEdit: (tool: Tool) => void;
}

export const ToolsTable = ({ onView, onEdit }: ToolsTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, isFetching } = useGetToolsQuery({
    page,
    per_page: pageSize,
    q: searchQuery || undefined,
  });

  const [deleteTool] = useDeleteToolMutation();

  const handleDelete = async (id: number) => {
    try {
      await deleteTool(id).unwrap();
      message.success('Tool deleted successfully');
    } catch (error) {
      message.error('Failed to delete tool');
    }
  };

  const getStatusColor = (status: ToolStatus): string => {
    const colors: Record<ToolStatus, string> = {
      available: 'green',
      checked_out: 'blue',
      maintenance: 'orange',
      retired: 'red',
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
      sorter: (a, b) => a.tool_number.localeCompare(b.tool_number),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Serial Number',
      dataIndex: 'serial_number',
      key: 'serial_number',
      width: 150,
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
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 150,
    },
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
        { text: 'Maintenance', value: 'maintenance' },
        { text: 'Retired', value: 'retired' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Calibration',
      dataIndex: 'calibration_status',
      key: 'calibration_status',
      width: 130,
      render: (status: CalibrationStatus, record) => {
        if (!record.requires_calibration) {
          return <Tag color="default">N/A</Tag>;
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
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => onView(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>
          <Tooltip title="QR Code">
            <Button
              type="text"
              icon={<QrcodeOutlined />}
              onClick={() => message.info('QR Code feature coming soon')}
            />
          </Tooltip>
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
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search tools..."
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
        dataSource={data?.tools || []}
        rowKey="id"
        loading={isLoading || isFetching}
        scroll={{ x: 1200 }}
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
  );
};
