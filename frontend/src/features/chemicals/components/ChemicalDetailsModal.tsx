import { Modal, Descriptions, Tag, Space, Button, Spin, Alert, Typography, Tabs, Badge, Card, Timeline, Empty } from 'antd';
import {
  ExperimentOutlined,
  WarningOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  ExportOutlined,
  ClockCircleOutlined,
  PlusCircleOutlined,
  SplitCellsOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetChemicalHistoryQuery } from '../services/chemicalsApi';
import type { Chemical, ChemicalStatus, ChemicalHistoryEvent } from '../types';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

interface ChemicalDetailsModalProps {
  open: boolean;
  onClose: () => void;
  chemical: Chemical | null;
  onIssue?: (chemical: Chemical) => void;
}

export const ChemicalDetailsModal = ({ open, onClose, chemical, onIssue }: ChemicalDetailsModalProps) => {
  const { data, isLoading, error } = useGetChemicalHistoryQuery(
    chemical?.id || 0,
    { skip: !open || !chemical }
  );

  const getStatusColor = (status: ChemicalStatus) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'low_stock':
        return 'warning';
      case 'out_of_stock':
        return 'error';
      case 'expired':
        return 'error';
      default:
        return 'default';
    }
  };

  const getEventIcon = (event: ChemicalHistoryEvent) => {
    switch (event.type) {
      case 'created':
        return <PlusCircleOutlined style={{ fontSize: '16px', color: '#52c41a' }} />;
      case 'issuance':
        return <ExportOutlined style={{ fontSize: '16px', color: '#1890ff' }} />;
      case 'child_lot_created':
        return <SplitCellsOutlined style={{ fontSize: '16px', color: '#722ed1' }} />;
      default:
        return <HistoryOutlined style={{ fontSize: '16px' }} />;
    }
  };

  const getEventColor = (event: ChemicalHistoryEvent) => {
    switch (event.type) {
      case 'created':
        return 'green';
      case 'issuance':
        return 'blue';
      case 'child_lot_created':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const renderEventContent = (event: ChemicalHistoryEvent) => {
    switch (event.type) {
      case 'created':
        return (
          <Card key={event.id} size="small" style={{ marginBottom: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="green">Created</Tag>
                <Text strong>{dayjs(event.event_date).format('MMM D, YYYY h:mm A')}</Text>
                <Text type="secondary">({dayjs(event.event_date).fromNow()})</Text>
              </Space>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Description">
                  {event.description}
                </Descriptions.Item>
                <Descriptions.Item label="Initial Quantity">
                  <Space>
                    <Badge count={event.quantity} showZero overflowCount={Infinity} style={{ backgroundColor: '#52c41a' }} />
                    <Text type="secondary">{event.unit}</Text>
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Space>
          </Card>
        );

      case 'issuance':
        return (
          <Card key={event.id} size="small" style={{ marginBottom: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="blue">Issuance</Tag>
                <Badge count={event.quantity} showZero style={{ backgroundColor: '#1890ff' }} />
                <Text type="secondary">{event.unit}</Text>
                <Text type="secondary">•</Text>
                <Text>{dayjs(event.event_date).format('MMM D, YYYY h:mm A')}</Text>
                <Text type="secondary">({dayjs(event.event_date).fromNow()})</Text>
              </Space>
              <Descriptions size="small" column={1}>
                {event.user_name && (
                  <Descriptions.Item label="Issued By">
                    {event.user_name}
                  </Descriptions.Item>
                )}
                {event.hangar && (
                  <Descriptions.Item label="Hangar">
                    {event.hangar}
                  </Descriptions.Item>
                )}
                {event.purpose && (
                  <Descriptions.Item label="Purpose">
                    {event.purpose}
                  </Descriptions.Item>
                )}
                {event.work_order && (
                  <Descriptions.Item label="Work Order">
                    {event.work_order}
                  </Descriptions.Item>
                )}
                {event.notes && (
                  <Descriptions.Item label="Notes">
                    {event.notes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Space>
          </Card>
        );

      case 'child_lot_created':
        return (
          <Card key={event.id} size="small" style={{ marginBottom: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="purple">Child Lot Created</Tag>
                <Text strong>{dayjs(event.event_date).format('MMM D, YYYY h:mm A')}</Text>
                <Text type="secondary">({dayjs(event.event_date).fromNow()})</Text>
              </Space>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Description">
                  {event.description}
                </Descriptions.Item>
                <Descriptions.Item label="Lot Number">
                  <Text strong>{event.lot_number}</Text>
                  {event.lot_sequence && (
                    <Text type="secondary"> (Sequence: {event.lot_sequence})</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Quantity">
                  <Space>
                    <Badge count={event.quantity} showZero overflowCount={Infinity} style={{ backgroundColor: '#722ed1' }} />
                    <Text type="secondary">{event.unit}</Text>
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Space>
          </Card>
        );

      default:
        return null;
    }
  };

  const handleIssue = () => {
    if (chemical && onIssue) {
      onIssue(chemical);
    }
  };

  const canIssue = chemical && chemical.status !== 'expired' && chemical.quantity > 0;

  const totalEvents = data?.history?.length ?? 0;
  const totalIssuances = data?.total_issuances ?? 0;
  const totalChildLots = data?.total_child_lots ?? 0;

  const tabItems = [
    {
      key: 'details',
      label: (
        <span>
          <InfoCircleOutlined /> Details
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Status Alerts */}
          {chemical?.status === 'low_stock' && (
            <Alert
              message="Low Stock Warning"
              description={`Current quantity (${chemical.quantity} ${chemical.unit}) is at or below minimum stock level${
                chemical.minimum_stock_level ? ` (${chemical.minimum_stock_level} ${chemical.unit})` : ''
              }.`}
              type="warning"
              showIcon
              icon={<WarningOutlined />}
            />
          )}

          {chemical?.status === 'out_of_stock' && (
            <Alert
              message="Out of Stock"
              description="This chemical is currently out of stock."
              type="error"
              showIcon
            />
          )}

          {chemical?.status === 'expired' && (
            <Alert
              message="Expired"
              description={`This chemical expired on ${dayjs(chemical.expiration_date).format('MMM D, YYYY')}.`}
              type="error"
              showIcon
            />
          )}

          {chemical?.expiring_soon && chemical?.status !== 'expired' && (
            <Alert
              message="Expiring Soon"
              description={`This chemical will expire on ${dayjs(chemical.expiration_date).format('MMM D, YYYY')}.`}
              type="warning"
              showIcon
            />
          )}

          {/* Chemical Information */}
          <Card title="Chemical Information">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Part Number" span={2}>
                <Text strong>{chemical?.part_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Lot Number" span={2}>
                <Text strong>{chemical?.lot_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(chemical?.status ?? 'available')}>
                  {chemical?.status?.replaceAll('_', ' ').toUpperCase() ?? 'UNKNOWN'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Quantity">
                <Space>
                  <Text strong>{chemical?.quantity}</Text>
                  <Text type="secondary">{chemical?.unit}</Text>
                  {chemical?.minimum_stock_level && chemical?.quantity <= chemical?.minimum_stock_level && (
                    <WarningOutlined style={{ color: '#faad14' }} />
                  )}
                </Space>
              </Descriptions.Item>
              {chemical?.description && (
                <Descriptions.Item label="Description" span={2}>
                  {chemical.description}
                </Descriptions.Item>
              )}
              {chemical?.manufacturer && (
                <Descriptions.Item label="Manufacturer">
                  {chemical.manufacturer}
                </Descriptions.Item>
              )}
              {chemical?.category && (
                <Descriptions.Item label="Category">
                  {chemical.category}
                </Descriptions.Item>
              )}
              {chemical?.minimum_stock_level && (
                <Descriptions.Item label="Minimum Stock Level">
                  {chemical.minimum_stock_level} {chemical.unit}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Location & Storage */}
          <Card title="Location & Storage">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Warehouse">
                {chemical?.warehouse_name || chemical?.warehouse_id || 'Not specified'}
              </Descriptions.Item>
              <Descriptions.Item label="Location">
                {chemical?.location || 'Not specified'}
              </Descriptions.Item>
              {chemical?.kit_name && (
                <Descriptions.Item label="Kit">
                  <Text strong>{chemical.kit_name}</Text>
                </Descriptions.Item>
              )}
              {chemical?.box_number && (
                <Descriptions.Item label="Box">
                  <Text strong>{chemical.box_number}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Dates & Tracking */}
          <Card title="Dates & Tracking">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Date Added">
                {dayjs(chemical?.date_added).format('MMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Expiration Date">
                {chemical?.expiration_date ? (
                  <Space>
                    {dayjs(chemical.expiration_date).format('MMM D, YYYY')}
                    {chemical.expiring_soon && chemical.status !== 'expired' && (
                      <Tag color="orange" icon={<ClockCircleOutlined />}>
                        Expiring Soon
                      </Tag>
                    )}
                  </Space>
                ) : (
                  'No expiration date'
                )}
              </Descriptions.Item>
              {chemical?.parent_lot_number && (
                <Descriptions.Item label="Parent Lot" span={2}>
                  {chemical.parent_lot_number}
                  {chemical.lot_sequence && ` (Sequence: ${chemical.lot_sequence})`}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Additional Information */}
          {chemical?.notes && (
            <Card title="Notes">
              <Text>{chemical.notes}</Text>
            </Card>
          )}

          {chemical?.is_archived && (
            <Card>
              <Alert
                message="Archived Chemical"
                description={
                  <Space direction="vertical">
                    {chemical.archived_reason && <Text>Reason: {chemical.archived_reason}</Text>}
                    {chemical.archived_date && (
                      <Text>Archived on: {dayjs(chemical.archived_date).format('MMM D, YYYY')}</Text>
                    )}
                  </Space>
                }
                type="info"
                showIcon
              />
            </Card>
          )}
        </Space>
      ),
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined /> History
          {totalEvents > 0 && (
            <Badge count={totalEvents} style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert
            message="Cradle-to-Grave History"
            description={
              <Space direction="vertical" size="small">
                <Text>Complete lifecycle history of this chemical</Text>
                <Space wrap>
                  {totalIssuances > 0 && (
                    <Tag color="blue">{totalIssuances} Issuance{totalIssuances !== 1 ? 's' : ''}</Tag>
                  )}
                  {totalChildLots > 0 && (
                    <Tag color="purple">{totalChildLots} Child Lot{totalChildLots !== 1 ? 's' : ''}</Tag>
                  )}
                </Space>
              </Space>
            }
            type="info"
            showIcon
          />

          {data?.history && data.history.length > 0 ? (
            <Timeline
              items={data.history.map((event) => ({
                color: getEventColor(event),
                dot: getEventIcon(event),
                children: renderEventContent(event),
              }))}
            />
          ) : (
            <Empty description="No history available" />
          )}
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <ExperimentOutlined style={{ fontSize: 24, color: '#52c41a' }} />
          <Title level={4} style={{ margin: 0 }}>
            Chemical Details
          </Title>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1000}
      footer={
        <Space>
          <Button key="close" onClick={onClose}>
            Close
          </Button>
          {canIssue && onIssue && (
            <Button
              key="issue"
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleIssue}
            >
              Issue Chemical
            </Button>
          )}
        </Space>
      }
    >
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px' }} role="status" aria-label="Loading chemical details">
          <Spin size="large" />
        </div>
      )}

      {error && (
        <Alert
          message="Error"
          description="Failed to load chemical details. Please try again."
          type="error"
          showIcon
        />
      )}

      {chemical && !isLoading && (
        <Tabs items={tabItems} defaultActiveKey="details" />
      )}
    </Modal>
  );
};
