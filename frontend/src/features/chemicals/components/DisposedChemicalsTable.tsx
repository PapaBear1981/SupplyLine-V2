import { useState } from 'react';
import { Table, Tag, Typography, Input, Space, Empty, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetDisposedChemicalsQuery } from '../services/chemicalsApi';
import type { DisposedChemical } from '../types';

const { Text } = Typography;

export const DisposedChemicalsTable = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useGetDisposedChemicalsQuery({
    page,
    per_page: pageSize,
  });

  // Filter locally since the API doesn't support search for disposed
  const filteredChemicals = data?.chemicals.filter((chemical) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      chemical.part_number.toLowerCase().includes(search) ||
      chemical.lot_number.toLowerCase().includes(search) ||
      chemical.description?.toLowerCase().includes(search) ||
      chemical.manufacturer?.toLowerCase().includes(search) ||
      chemical.archived_reason?.toLowerCase().includes(search)
    );
  });

  const getReasonColor = (reason: string | null | undefined) => {
    switch (reason) {
      case 'expired':
        return 'red';
      case 'damaged':
        return 'orange';
      case 'contaminated':
        return 'volcano';
      case 'recalled':
        return 'magenta';
      default:
        return 'default';
    }
  };

  const getReasonLabel = (reason: string | null | undefined) => {
    switch (reason) {
      case 'expired':
        return 'Expired';
      case 'damaged':
        return 'Damaged';
      case 'contaminated':
        return 'Contaminated';
      case 'recalled':
        return 'Recalled';
      case 'manual_disposal':
        return 'Manual Disposal';
      default:
        return reason || 'Unknown';
    }
  };

  const columns: ColumnsType<DisposedChemical> = [
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      render: (text: string) => <Text strong>{text}</Text>,
      sorter: (a, b) => a.part_number.localeCompare(b.part_number),
    },
    {
      title: 'Lot Number',
      dataIndex: 'lot_number',
      key: 'lot_number',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string | null) => text || <Text type="secondary">-</Text>,
    },
    {
      title: 'Quantity Disposed',
      key: 'quantity',
      render: (_, record) => {
        const qty = record.disposal_record
          ? Math.abs(record.disposal_record.quantity_change)
          : record.quantity;
        return (
          <Text type="danger">
            <DeleteOutlined style={{ marginRight: 4 }} />
            {qty} {record.unit}
          </Text>
        );
      },
    },
    {
      title: 'Reason',
      dataIndex: 'archived_reason',
      key: 'reason',
      render: (reason: string | null) => (
        <Tag color={getReasonColor(reason)} icon={<ExclamationCircleOutlined />}>
          {getReasonLabel(reason)}
        </Tag>
      ),
      filters: [
        { text: 'Expired', value: 'expired' },
        { text: 'Damaged', value: 'damaged' },
        { text: 'Contaminated', value: 'contaminated' },
        { text: 'Recalled', value: 'recalled' },
        { text: 'Manual Disposal', value: 'manual_disposal' },
      ],
      onFilter: (value, record) => record.archived_reason === value,
    },
    {
      title: 'Expiration Date',
      dataIndex: 'expiration_date',
      key: 'expiration_date',
      render: (date: string | null) =>
        date ? (
          <Tooltip title={dayjs(date).format('MMMM D, YYYY')}>
            <Text type={dayjs(date).isBefore(dayjs()) ? 'danger' : undefined}>
              {dayjs(date).format('MMM D, YYYY')}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
      sorter: (a, b) => {
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return dayjs(a.expiration_date).unix() - dayjs(b.expiration_date).unix();
      },
    },
    {
      title: 'Disposal Date',
      dataIndex: 'archived_date',
      key: 'archived_date',
      render: (date: string | null) =>
        date ? (
          <Text>{dayjs(date).format('MMM D, YYYY h:mm A')}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
      sorter: (a, b) => {
        if (!a.archived_date) return 1;
        if (!b.archived_date) return -1;
        return dayjs(a.archived_date).unix() - dayjs(b.archived_date).unix();
      },
      defaultSortOrder: 'descend',
    },
    {
      title: 'Location',
      key: 'location',
      render: (_, record) => {
        const location =
          record.disposal_record?.location_from || record.location;
        return location ? <Text>{location}</Text> : <Text type="secondary">-</Text>;
      },
    },
    {
      title: 'Notes',
      key: 'notes',
      ellipsis: true,
      render: (_, record) => {
        const notes = record.disposal_record?.notes || record.notes;
        return notes ? (
          <Tooltip title={notes}>
            <Text ellipsis style={{ maxWidth: 200 }}>
              {notes}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search disposed chemicals..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </Space>

      <Table
        columns={columns}
        dataSource={filteredChemicals}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: data?.pagination.total || 0,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50', '100'],
          showTotal: (total) => `Total ${total} disposed chemicals`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No disposed chemicals found"
            />
          ),
        }}
        size="small"
      />
    </div>
  );
};

export default DisposedChemicalsTable;
