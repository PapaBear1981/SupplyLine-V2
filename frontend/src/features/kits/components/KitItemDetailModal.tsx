import { useState } from 'react';
import {
  Modal,
  Descriptions,
  Table,
  Tag,
  Space,
  Button,
  Spin,
  Alert,
  Typography,
  Tabs,
  Badge,
  Card,
  Tooltip,
} from 'antd';
import {
  IssuesCloseOutlined,
  WarningOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useGetKitItemDetailsQuery } from '../services/kitsApi';
import type { KitIssuance, ItemStatus, KitItem } from '../types';
import KitIssuanceForm from './KitIssuanceForm';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// Extended type for item details response from backend
interface KitItemDetails {
  id: number;
  kit_id: number;
  kit_name?: string;
  box_id: number;
  box_number?: string;
  item_type: string;
  item_id: number;
  quantity: number;
  location?: string;
  status: ItemStatus;
  added_date?: string;
  last_updated?: string;
  part_number?: string;
  serial_number?: string;
  lot_number?: string;
  description?: string;
  manufacturer?: string;
  model?: string;
  category?: string;
  unit?: string;
  minimum_stock_level?: number;
  tracking_type?: string;
  warehouse_id?: number;
}

interface KitItemDetailModalProps {
  open: boolean;
  onClose: () => void;
  kitId: number;
  itemId: number;
}

const KitItemDetailModal = ({ open, onClose, kitId, itemId }: KitItemDetailModalProps) => {
  const [issuanceModalVisible, setIssuanceModalVisible] = useState(false);
  const { data, isLoading, error } = useGetKitItemDetailsQuery(
    { kitId, itemId },
    { skip: !open || !itemId }
  );

  // Cast item to our extended type that includes backend-specific fields
  const item = data?.item as KitItemDetails | undefined;

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

  const historyColumns: ColumnsType<KitIssuance> = [
    {
      title: 'Date',
      dataIndex: 'issued_date',
      key: 'issued_date',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString(),
      sorter: (a, b) => new Date(a.issued_date).getTime() - new Date(b.issued_date).getTime(),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (quantity: number) => (
        <Badge count={quantity} showZero style={{ backgroundColor: '#52c41a' }} />
      ),
    },
    {
      title: 'Issued To',
      dataIndex: 'issued_to',
      key: 'issued_to',
      ellipsis: true,
    },
    {
      title: 'Issued By',
      dataIndex: 'issued_by_name',
      key: 'issued_by_name',
      ellipsis: true,
    },
    {
      title: 'Work Order',
      dataIndex: 'work_order',
      key: 'work_order',
      width: 150,
      render: (wo: string | null) => wo || '-',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (notes: string | null) => notes || '-',
    },
  ];

  const handleIssue = () => {
    if (item && item.item_type !== 'tool' && item.quantity > 0) {
      setIssuanceModalVisible(true);
    }
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <span style={{ fontSize: 24 }}>
              {item ? getItemTypeIcon(item.item_type) : ''}
            </span>
            <Title level={4} style={{ margin: 0 }}>
              Item Details
            </Title>
          </Space>
        }
        open={open}
        onCancel={onClose}
        width={1000}
        footer={[
          <Button key="close" onClick={onClose}>
            Close
          </Button>,
          item && item.item_type !== 'tool' && item.quantity > 0 && (
            <Button
              key="issue"
              type="primary"
              icon={<IssuesCloseOutlined />}
              onClick={handleIssue}
            >
              Issue Item
            </Button>
          ),
        ]}
      >
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        )}

        {error && (
          <Alert
            message="Error"
            description="Failed to load item details. Please try again."
            type="error"
            showIcon
          />
        )}

        {item && (
          <Tabs defaultActiveKey="details">
            <TabPane
              tab={
                <span>
                  <InfoCircleOutlined /> Details
                </span>
              }
              key="details"
            >
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {/* Status Alert */}
                {item.status === 'low_stock' && (
                  <Alert
                    message="Low Stock Warning"
                    description={`Current quantity (${item.quantity}) is at or below minimum stock level${
                      item.minimum_stock_level
                        ? ` (${item.minimum_stock_level})`
                        : ''
                    }.`}
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                  />
                )}

                {item.status === 'out_of_stock' && (
                  <Alert
                    message="Out of Stock"
                    description="This item is currently out of stock."
                    type="error"
                    showIcon
                  />
                )}

                {/* Item Information */}
                <Card title="Item Information">
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="Item Type">
                      <Space>
                        <span style={{ fontSize: 20 }}>
                          {getItemTypeIcon(item.item_type)}
                        </span>
                        <Text strong>
                          {item.item_type.charAt(0).toUpperCase() +
                            item.item_type.slice(1)}
                        </Text>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Tag color={getStatusColor(item.status)}>
                        {item.status.replace('_', ' ').toUpperCase()}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Part Number" span={2}>
                      <Text strong>{item.part_number || 'N/A'}</Text>
                    </Descriptions.Item>
                    {item.serial_number && (
                      <Descriptions.Item label="Serial Number" span={2}>
                        {item.serial_number}
                      </Descriptions.Item>
                    )}
                    {item.lot_number && (
                      <Descriptions.Item label="Lot Number" span={2}>
                        {item.lot_number}
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="Description" span={2}>
                      {item.description}
                    </Descriptions.Item>
                    {item.manufacturer && (
                      <Descriptions.Item label="Manufacturer">
                        {item.manufacturer}
                      </Descriptions.Item>
                    )}
                    {item.category && (
                      <Descriptions.Item label="Category">
                        {item.category}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>

                {/* Location & Quantity */}
                <Card title="Location & Quantity">
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="Kit">
                      <Text strong>{item.kit_name}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Box">
                      <Text strong>{item.box_number}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Location">
                      {item.location || 'Not specified'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Quantity">
                      <Space>
                        <Badge
                          count={item.quantity}
                          showZero
                          overflowCount={Infinity}
                          style={{
                            backgroundColor:
                              item.minimum_stock_level &&
                              item.quantity <= item.minimum_stock_level
                                ? '#faad14'
                                : '#52c41a',
                          }}
                        />
                        {item.unit && <Text type="secondary">{item.unit}</Text>}
                        {item.minimum_stock_level &&
                          item.quantity <= item.minimum_stock_level && (
                            <Tooltip title={`Minimum stock level: ${item.minimum_stock_level}`}>
                              <WarningOutlined style={{ color: '#faad14' }} />
                            </Tooltip>
                          )}
                      </Space>
                    </Descriptions.Item>
                    {item.minimum_stock_level && (
                      <Descriptions.Item label="Minimum Stock Level">
                        {item.minimum_stock_level} {item.unit || ''}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>

                {/* Tracking Information */}
                <Card title="Tracking Information">
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="Added Date">
                      {item.added_date
                        ? new Date(item.added_date).toLocaleString()
                        : 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Updated">
                      {item.last_updated
                        ? new Date(item.last_updated).toLocaleString()
                        : 'N/A'}
                    </Descriptions.Item>
                    {item.tracking_type && (
                      <Descriptions.Item label="Tracking Type" span={2}>
                        {item.tracking_type.toUpperCase()}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </Space>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <HistoryOutlined /> History
                  {(data?.total_issuances || 0) > 0 && (
                    <Badge count={data?.total_issuances || 0} style={{ marginLeft: 8 }} />
                  )}
                </span>
              }
              key="history"
            >
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Alert
                  message={`${data?.total_issuances || 0} Total Issuance${
                    (data?.total_issuances || 0) !== 1 ? 's' : ''
                  }`}
                  description={
                    (data?.total_issuances || 0) === 0
                      ? 'This item has not been issued yet.'
                      : `This item has been issued ${data?.total_issuances || 0} time${
                          (data?.total_issuances || 0) !== 1 ? 's' : ''
                        }.`
                  }
                  type="info"
                  showIcon
                />

                <Table
                  columns={historyColumns}
                  dataSource={data?.history || []}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} issuances`,
                  }}
                />
              </Space>
            </TabPane>
          </Tabs>
        )}
      </Modal>

      {item && (
        <KitIssuanceForm
          visible={issuanceModalVisible}
          kitId={kitId}
          item={item as KitItem}
          onClose={() => setIssuanceModalVisible(false)}
        />
      )}
    </>
  );
};

export default KitItemDetailModal;
