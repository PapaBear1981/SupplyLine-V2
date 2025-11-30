import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  Tag,
  Typography,
  Badge,
  message,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  IssuesCloseOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useGetKitItemsQuery } from '../services/kitsApi';
import type { KitItem, ItemStatus } from '../types';
import KitIssuanceForm from './KitIssuanceForm';

const { Option } = Select;
const { Title, Text } = Typography;

interface KitItemListProps {
  kitId: number;
}

const KitItemList = ({ kitId }: KitItemListProps) => {
  const [boxFilter, setBoxFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<ItemStatus | undefined>();
  const [issuanceModalVisible, setIssuanceModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KitItem | null>(null);

  const { data: itemsData, isLoading } = useGetKitItemsQuery({
    kitId,
    params: {
      box_id: boxFilter,
      status: statusFilter,
    },
  });

  const allItems = [
    ...(itemsData?.items || []),
    ...(itemsData?.expendables || []),
  ];

  const boxes = Array.from(
    new Set(allItems.map((item) => item.box_number).filter(Boolean))
  ).sort();

  const handleIssue = (item: KitItem) => {
    // Only expendables can be issued
    if (item.item_type === 'tool') {
      message.warning('Tools cannot be issued from kits. Use transfer or retire instead.');
      return;
    }
    setSelectedItem(item);
    setIssuanceModalVisible(true);
  };

  const getStatusColor = (status: ItemStatus) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'low_stock':
        return 'warning';
      case 'out_of_stock':
        return 'error';
      case 'issued':
        return 'default';
      case 'maintenance':
        return 'processing';
      default:
        return 'default';
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'tool':
        return '🔧';
      case 'chemical':
        return '⚗️';
      case 'expendable':
        return '📦';
      default:
        return '📦';
    }
  };

  const columns: ColumnsType<KitItem> = [
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 80,
      render: (type: string) => (
        <Tooltip title={type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown'}>
          <span style={{ fontSize: 20 }}>{getItemTypeIcon(type || 'expendable')}</span>
        </Tooltip>
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
      render: (partNumber: string, record: KitItem) => (
        <Space direction="vertical" size={0}>
          <Text strong>{partNumber}</Text>
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
      title: 'Box',
      dataIndex: 'box_number',
      key: 'box_number',
      width: 100,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (quantity: number, record: KitItem) => {
        const unit = 'unit' in record ? (record as KitItem & { unit?: string }).unit : undefined;
        const minStock = record.minimum_stock_level;
        const isLow = minStock && quantity <= minStock;

        return (
          <Space>
            <Badge
              count={quantity}
              showZero
              style={{
                backgroundColor: isLow ? '#faad14' : '#52c41a',
              }}
            />
            {unit && <Text type="secondary">{unit}</Text>}
            {isLow && (
              <Tooltip title={`Minimum stock level: ${minStock}`}>
                <WarningOutlined style={{ color: '#faad14' }} />
              </Tooltip>
            )}
          </Space>
        );
      },
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ItemStatus) => (
        <Tag color={getStatusColor(status)}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record: KitItem) => (
        <Space size="small">
          {record.item_type !== 'tool' && record.quantity > 0 && (
            <Button
              type="link"
              size="small"
              icon={<IssuesCloseOutlined />}
              onClick={() => handleIssue(record)}
            >
              Issue
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              Kit Items
            </Title>
            <Badge count={itemsData?.total_count || 0} showZero />
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="Filter by box"
              style={{ width: 150 }}
              value={boxFilter}
              onChange={setBoxFilter}
              allowClear
            >
              {boxes.map((box) => (
                <Option key={box} value={box}>
                  {box}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="Filter by status"
              style={{ width: 150 }}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
            >
              <Option value="available">Available</Option>
              <Option value="low_stock">Low Stock</Option>
              <Option value="out_of_stock">Out of Stock</Option>
              <Option value="issued">Issued</Option>
              <Option value="maintenance">Maintenance</Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />}>
              Add Item
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={allItems}
          rowKey={(record) => `${record.source || 'item'}-${record.id}`}
          loading={isLoading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
          }}
        />
      </Card>

      <KitIssuanceForm
        visible={issuanceModalVisible}
        kitId={kitId}
        item={selectedItem}
        onClose={() => {
          setIssuanceModalVisible(false);
          setSelectedItem(null);
        }}
      />
    </>
  );
};

export default KitItemList;
