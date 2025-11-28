import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Descriptions,
  Tag,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Alert,
  Spin,
  Typography,
  Badge,
  Modal,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  useGetKitQuery,
  useDeleteKitMutation,
  useGetKitAlertsQuery,
  useGetKitAnalyticsQuery,
} from '../services/kitsApi';
import type { KitStatus } from '../types';
import KitBoxManager from '../components/KitBoxManager';
import KitItemList from '../components/KitItemList';
import KitIssuanceHistory from '../components/KitIssuanceHistory';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const KitDetailView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const kitId = parseInt(id || '0');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: kit, isLoading, error } = useGetKitQuery(kitId);
  const { data: alerts } = useGetKitAlertsQuery(kitId);
  const { data: analytics } = useGetKitAnalyticsQuery({ kitId, days: 30 });
  const [deleteKit, { isLoading: isDeleting }] = useDeleteKitMutation();

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Kit',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete kit "${kit?.name}"? This will set the kit status to inactive.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteKit(kitId).unwrap();
          message.success('Kit deleted successfully');
          navigate('/kits');
        } catch (error: unknown) {
          const err = error as { data?: { error?: string } };
          message.error(err.data?.error || 'Failed to delete kit');
        }
      },
    });
  };

  const getStatusColor = (status: KitStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'maintenance':
        return 'warning';
      case 'inactive':
        return 'default';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !kit) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Error"
          description="Failed to load kit details. Please try again."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <Card>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/kits')}>
                Back
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                <ToolOutlined /> {kit.name}
              </Title>
              <Tag color={getStatusColor(kit.status)}>{kit.status.toUpperCase()}</Tag>
            </Space>
            <Space>
              <Button icon={<CopyOutlined />} onClick={() => navigate(`/kits/${kit.id}/duplicate`)}>
                Duplicate
              </Button>
              <Button icon={<EditOutlined />} onClick={() => navigate(`/kits/${kit.id}/edit`)}>
                Edit
              </Button>
              <Button
                icon={<DeleteOutlined />}
                danger
                onClick={handleDelete}
                loading={isDeleting}
              >
                Delete
              </Button>
            </Space>
          </Space>
        </Card>

        {/* Alerts */}
        {alerts && alerts.alert_count > 0 && (
          <Alert
            message={`${alerts.alert_count} Alert${alerts.alert_count > 1 ? 's' : ''}`}
            description={
              <Space direction="vertical">
                {alerts.alerts.slice(0, 3).map((alert, index) => (
                  <Text key={index}>
                    <WarningOutlined /> {alert.message}
                  </Text>
                ))}
                {alerts.alert_count > 3 && (
                  <Text type="secondary">
                    ...and {alerts.alert_count - 3} more alert{alerts.alert_count - 3 > 1 ? 's' : ''}
                  </Text>
                )}
              </Space>
            }
            type="warning"
            showIcon
          />
        )}

        {/* Statistics */}
        {analytics && (
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Total Items"
                  value={analytics.inventory.total_items}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Low Stock Items"
                  value={analytics.inventory.low_stock_items}
                  valueStyle={{
                    color: analytics.inventory.low_stock_items > 0 ? '#cf1322' : '#3f8600',
                  }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Issuances (30 days)"
                  value={analytics.issuances.total}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      ({analytics.issuances.average_per_day}/day)
                    </Text>
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Pending Reorders"
                  value={analytics.reorders.pending}
                  prefix={
                    analytics.reorders.pending > 0 ? <ExclamationCircleOutlined /> : undefined
                  }
                  valueStyle={{
                    color: analytics.reorders.pending > 0 ? '#faad14' : '#3f8600',
                  }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Tabs */}
        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="Overview" key="overview">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Kit Name">{kit.name}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(kit.status)}>{kit.status.toUpperCase()}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Aircraft Type">
                  {kit.aircraft_type_name}
                </Descriptions.Item>
                <Descriptions.Item label="Created By">{kit.creator_name}</Descriptions.Item>
                <Descriptions.Item label="Created At">
                  {new Date(kit.created_at).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {new Date(kit.updated_at).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Boxes">
                  <Badge count={kit.box_count} showZero />
                </Descriptions.Item>
                <Descriptions.Item label="Items">
                  <Badge count={kit.item_count} showZero />
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                  {kit.description || 'No description'}
                </Descriptions.Item>
              </Descriptions>
            </TabPane>

            <TabPane
              tab={
                <span>
                  Boxes & Items
                  {kit.item_count ? <Badge count={kit.item_count} style={{ marginLeft: 8 }} /> : null}
                </span>
              }
              key="items"
            >
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <KitBoxManager kitId={kitId} />
                <KitItemList kitId={kitId} />
              </Space>
            </TabPane>

            <TabPane
              tab={
                <span>
                  Issuance History
                </span>
              }
              key="issuances"
            >
              <KitIssuanceHistory kitId={kitId} />
            </TabPane>

            <TabPane
              tab={
                <span>
                  Reorders
                  {analytics?.reorders.pending ? (
                    <Badge count={analytics.reorders.pending} style={{ marginLeft: 8 }} />
                  ) : null}
                </span>
              }
              key="reorders"
            >
              <Text>Reorder management coming soon...</Text>
            </TabPane>

            <TabPane tab="Messages" key="messages">
              <Text>Kit messages coming soon...</Text>
            </TabPane>

            <TabPane tab="Analytics" key="analytics">
              <Text>Detailed analytics coming soon...</Text>
            </TabPane>
          </Tabs>
        </Card>
      </Space>
    </div>
  );
};

export default KitDetailView;
