import { Button, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { TransferStatusTag } from './TransferStatusTag';
import type { Transfer } from '../types';

const { Text } = Typography;

export interface TransfersTableProps {
  rows: Transfer[];
  loading?: boolean;
  onReceive?: (transfer: Transfer) => void;
  onCancel?: (transfer: Transfer) => void;
  canReceive?: boolean;
  canCancel?: (transfer: Transfer) => boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
}

export const TransfersTable = ({
  rows,
  loading,
  onReceive,
  onCancel,
  canReceive = false,
  canCancel,
  pagination,
}: TransfersTableProps) => {
  const columns: ColumnsType<Transfer> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: 'Item',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag>{record.item_type}</Tag>
          <Text strong>
            {record.item_snapshot?.identifier || `ID ${record.item_id}`}
          </Text>
          {record.item_snapshot?.description && (
            <Text type="secondary">{record.item_snapshot.description}</Text>
          )}
          {record.item_snapshot?.serial_number && (
            <Text type="secondary">S/N: {record.item_snapshot.serial_number}</Text>
          )}
          {record.item_snapshot?.lot_number && (
            <Text type="secondary">Lot: {record.item_snapshot.lot_number}</Text>
          )}
        </Space>
      ),
    },
    { title: 'Qty', dataIndex: 'quantity', width: 70 },
    { title: 'From', dataIndex: 'from_warehouse' },
    { title: 'To', dataIndex: 'to_warehouse' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value) => <TransferStatusTag status={value} />,
      width: 140,
    },
    {
      title: 'Initiated',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.transferred_by}</Text>
          <Text type="secondary">
            {record.transfer_date
              ? dayjs(record.transfer_date).format('MMM D, YYYY h:mm A')
              : '—'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Received',
      render: (_, record) =>
        record.received_by ? (
          <Space direction="vertical" size={0}>
            <Text>{record.received_by}</Text>
            <Text type="secondary">
              {record.received_date
                ? dayjs(record.received_date).format('MMM D, YYYY h:mm A')
                : '—'}
            </Text>
            {record.destination_location && (
              <Text type="secondary">@ {record.destination_location}</Text>
            )}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space>
          {canReceive && record.status === 'pending_receipt' && onReceive && (
            <Button type="primary" size="small" onClick={() => onReceive(record)}>
              Receive
            </Button>
          )}
          {onCancel &&
            record.status === 'pending_receipt' &&
            (canCancel ? canCancel(record) : false) && (
              <Button danger size="small" onClick={() => onCancel(record)}>
                Cancel
              </Button>
            )}
        </Space>
      ),
    },
  ];

  return (
    <Table<Transfer>
      rowKey="id"
      columns={columns}
      dataSource={rows}
      loading={loading}
      pagination={
        pagination
          ? {
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: pagination.onChange,
              showSizeChanger: false,
            }
          : false
      }
      scroll={{ x: 1100 }}
    />
  );
};
