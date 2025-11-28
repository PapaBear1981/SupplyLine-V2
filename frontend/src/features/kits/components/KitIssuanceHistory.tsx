import { useState } from 'react';
import { Card, Table, DatePicker, Space, Typography, Tag } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Dayjs } from 'dayjs';
import { useGetKitIssuancesQuery } from '../services/kitsApi';
import type { KitIssuance, ItemType } from '../types';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

interface KitIssuanceHistoryProps {
  kitId: number;
}

const KitIssuanceHistory = ({ kitId }: KitIssuanceHistoryProps) => {
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const { data: issuances = [], isLoading } = useGetKitIssuancesQuery({
    kitId,
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
  });

  const getItemTypeColor = (type: ItemType) => {
    switch (type) {
      case 'tool':
        return 'blue';
      case 'chemical':
        return 'purple';
      case 'expendable':
        return 'green';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<KitIssuance> = [
    {
      title: 'Date',
      dataIndex: 'issued_date',
      key: 'issued_date',
      render: (date: string) => new Date(date).toLocaleString(),
      sorter: (a, b) => new Date(a.issued_date).getTime() - new Date(b.issued_date).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      render: (type: ItemType) => (
        <Tag color={getItemTypeColor(type)}>{type.toUpperCase()}</Tag>
      ),
      filters: [
        { text: 'Tool', value: 'tool' },
        { text: 'Chemical', value: 'chemical' },
        { text: 'Expendable', value: 'expendable' },
      ],
      onFilter: (value, record) => record.item_type === value,
    },
    {
      title: 'Part/Tool Number',
      dataIndex: 'part_number',
      key: 'part_number',
      render: (partNumber: string, record: KitIssuance) => (
        <Space direction="vertical" size={0}>
          <Text>{partNumber}</Text>
          {record.serial_number && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              S/N: {record.serial_number}
            </Text>
          )}
          {record.lot_number && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Lot: {record.lot_number}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true,
    },
    {
      title: 'Work Order',
      dataIndex: 'work_order',
      key: 'work_order',
    },
    {
      title: 'Issued By',
      dataIndex: 'issuer_name',
      key: 'issuer_name',
    },
    {
      title: 'Issued To',
      dataIndex: 'recipient_name',
      key: 'recipient_name',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ];

  return (
    <Card
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            <FileTextOutlined /> Issuance History
          </Title>
        </Space>
      }
      extra={
        <RangePicker
          value={dateRange}
          onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
          format="YYYY-MM-DD"
        />
      }
    >
      <Table
        columns={columns}
        dataSource={issuances}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} issuances`,
        }}
      />
    </Card>
  );
};

export default KitIssuanceHistory;
