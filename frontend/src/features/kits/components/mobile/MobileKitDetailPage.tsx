import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  NavBar,
  Card,
  List,
  Tag,
  Button,
  Skeleton,
  Toast,
  Dialog,
  Tabs,
  Badge,
  ErrorBlock,
  Grid,
  Popup,
} from 'antd-mobile';
import {
  MoreOutline,
} from 'antd-mobile-icons';
import {
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ToolOutlined,
  InboxOutlined,
  EnvironmentOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SwapOutlined,
  ShoppingCartOutlined,
  MessageOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetKitQuery,
  useDeleteKitMutation,
  useGetKitAlertsQuery,
  useGetKitAnalyticsQuery,
} from '../../services/kitsApi';
import type { KitStatus } from '../../types';
import EditKitModal from '../EditKitModal';
import './MobileKitDetailPage.css';

// Status color mapping
const statusColors: Record<KitStatus, string> = {
  active: '#52c41a',
  deployed: '#1890ff',
  maintenance: '#faad14',
  inactive: '#8c8c8c',
  retired: '#ff4d4f',
};

export const MobileKitDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const kitId = parseInt(id || '0');
  const [activeTab, setActiveTab] = useState('overview');
  const [showMorePopup, setShowMorePopup] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: kit, isLoading, error, refetch } = useGetKitQuery(kitId);
  const { data: alerts } = useGetKitAlertsQuery(kitId);
  const { data: analytics } = useGetKitAnalyticsQuery({ kitId, days: 30 });
  const [deleteKit, { isLoading: isDeleting }] = useDeleteKitMutation();

  const handleDelete = async () => {
    const confirmed = await Dialog.confirm({
      content: `Are you sure you want to delete kit "${kit?.name}"? This will set the kit status to inactive.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (confirmed) {
      try {
        await deleteKit(kitId).unwrap();
        Toast.show({ content: 'Kit deleted', icon: 'success' });
        navigate('/kits');
      } catch {
        Toast.show({ content: 'Failed to delete kit', icon: 'fail' });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="mobile-kit-detail">
        <NavBar onBack={() => navigate('/kits')}>Kit Details</NavBar>
        <div className="loading-container">
          <Skeleton.Title animated />
          <Skeleton.Paragraph lineCount={5} animated />
        </div>
      </div>
    );
  }

  if (error || !kit) {
    return (
      <div className="mobile-kit-detail">
        <NavBar onBack={() => navigate('/kits')}>Kit Details</NavBar>
        <ErrorBlock
          status="default"
          title="Failed to load kit"
          description="Please try again later"
        />
      </div>
    );
  }

  return (
    <div className="mobile-kit-detail">
      {/* Navigation Bar */}
      <NavBar
        onBack={() => navigate('/kits')}
        right={
          <MoreOutline
            fontSize={24}
            onClick={() => setShowMorePopup(true)}
          />
        }
      >
        Kit Details
      </NavBar>

      {/* Kit Header */}
      <div className="kit-header">
        <div className="kit-header-content">
          <div className="kit-icon-wrapper" style={{ background: `${statusColors[kit.status]}20` }}>
            <ToolOutlined style={{ fontSize: 28, color: statusColors[kit.status] }} />
          </div>
          <div className="kit-header-info">
            <h1 className="kit-name">{kit.name}</h1>
            <div className="kit-subtitle">{kit.aircraft_type_name || 'No Aircraft Type'}</div>
          </div>
          <Tag color={statusColors[kit.status]} className="kit-status-tag">
            {kit.status.replace('_', ' ').toUpperCase()}
          </Tag>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts && alerts.alert_count > 0 && (
        <div className="alerts-banner">
          <WarningOutlined style={{ fontSize: 16, marginRight: 8 }} />
          <span>
            {alerts.alert_count} alert{alerts.alert_count > 1 ? 's' : ''} need attention
          </span>
        </div>
      )}

      {/* Stats Grid */}
      {analytics && (
        <Grid columns={4} gap={8} className="stats-grid">
          <Grid.Item>
            <div className="stat-item">
              <div className="stat-value">{analytics.inventory.total_items}</div>
              <div className="stat-label">Items</div>
            </div>
          </Grid.Item>
          <Grid.Item>
            <div className="stat-item">
              <div className="stat-value" style={{ color: analytics.inventory.low_stock_items > 0 ? '#ff4d4f' : undefined }}>
                {analytics.inventory.low_stock_items}
              </div>
              <div className="stat-label">Low Stock</div>
            </div>
          </Grid.Item>
          <Grid.Item>
            <div className="stat-item">
              <div className="stat-value">{analytics.issuances.total}</div>
              <div className="stat-label">Issuances</div>
            </div>
          </Grid.Item>
          <Grid.Item>
            <div className="stat-item">
              <div className="stat-value" style={{ color: analytics.reorders.pending > 0 ? '#faad14' : undefined }}>
                {analytics.reorders.pending}
              </div>
              <div className="stat-label">Reorders</div>
            </div>
          </Grid.Item>
        </Grid>
      )}

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} className="kit-tabs">
        <Tabs.Tab title="Overview" key="overview" />
        <Tabs.Tab
          title={
            <Badge content={kit.item_count || null} style={{ '--right': '-10px', '--top': '-3px' }}>
              Items
            </Badge>
          }
          key="items"
        />
        <Tabs.Tab title="Location" key="location" />
        <Tabs.Tab title="More" key="more" />
      </Tabs>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Quick Actions */}
            <Card className="action-card">
              <Grid columns={4} gap={12}>
                <Grid.Item>
                  <div className="quick-action" onClick={() => setActiveTab('items')}>
                    <Badge content={kit.box_count || 0}>
                      <div className="action-icon">
                        <InboxOutlined />
                      </div>
                    </Badge>
                    <span>Boxes</span>
                  </div>
                </Grid.Item>
                <Grid.Item>
                  <div className="quick-action" onClick={() => setActiveTab('items')}>
                    <Badge content={kit.item_count || 0}>
                      <div className="action-icon">
                        <ToolOutlined />
                      </div>
                    </Badge>
                    <span>Items</span>
                  </div>
                </Grid.Item>
                <Grid.Item>
                  <div className="quick-action" onClick={() => setActiveTab('location')}>
                    <div className="action-icon" style={{ color: kit.has_location ? '#52c41a' : '#8c8c8c' }}>
                      <EnvironmentOutlined />
                    </div>
                    <span>Location</span>
                  </div>
                </Grid.Item>
                <Grid.Item>
                  <div className="quick-action" onClick={() => setActiveTab('more')}>
                    {analytics && analytics.reorders.pending > 0 ? (
                      <Badge content={analytics.reorders.pending}>
                        <div className="action-icon" style={{ color: '#faad14' }}>
                          <ShoppingCartOutlined />
                        </div>
                      </Badge>
                    ) : (
                      <div className="action-icon">
                        <ShoppingCartOutlined />
                      </div>
                    )}
                    <span>Reorders</span>
                  </div>
                </Grid.Item>
              </Grid>
            </Card>

            {/* Kit Details */}
            <Card title="Kit Information" className="info-card">
              <List>
                {kit.description && (
                  <List.Item
                    prefix={<FileTextOutlined />}
                    description="Description"
                  >
                    {kit.description}
                  </List.Item>
                )}
                <List.Item
                  prefix={<UserOutlined />}
                  extra={kit.creator_name || 'Unknown'}
                >
                  Created By
                </List.Item>
                <List.Item
                  prefix={<CalendarOutlined />}
                  extra={dayjs(kit.created_at).format('MMM D, YYYY')}
                >
                  Created Date
                </List.Item>
                {kit.updated_at && kit.updated_at !== kit.created_at && (
                  <List.Item
                    prefix={<CalendarOutlined />}
                    extra={dayjs(kit.updated_at).format('MMM D, YYYY')}
                  >
                    Last Updated
                  </List.Item>
                )}
                {kit.trailer_number && (
                  <List.Item extra={kit.trailer_number}>
                    Trailer Number
                  </List.Item>
                )}
              </List>
            </Card>

            {/* Alerts */}
            {alerts && alerts.alerts.length > 0 && (
              <Card title="Active Alerts" className="alerts-card">
                <List>
                  {alerts.alerts.slice(0, 5).map((alert, index) => (
                    <List.Item
                      key={index}
                      prefix={
                        <ExclamationCircleOutlined
                          style={{
                            color: alert.severity === 'high' ? '#ff4d4f' : alert.severity === 'medium' ? '#faad14' : '#1890ff'
                          }}
                        />
                      }
                      description={alert.part_number || alert.description}
                    >
                      {alert.message}
                    </List.Item>
                  ))}
                </List>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'items' && (
          <div className="items-tab">
            <Card className="info-card">
              <List header="Boxes & Items">
                <List.Item
                  prefix={<InboxOutlined style={{ fontSize: 20, color: '#1890ff' }} />}
                  extra={<Badge content={kit.box_count || 0} />}
                  arrow
                  onClick={() => {/* TODO: Navigate to boxes */}}
                >
                  Boxes
                </List.Item>
                <List.Item
                  prefix={<ToolOutlined style={{ fontSize: 20, color: '#52c41a' }} />}
                  extra={<Badge content={kit.item_count || 0} />}
                  arrow
                  onClick={() => {/* TODO: Navigate to items */}}
                >
                  All Items
                </List.Item>
              </List>
            </Card>

            <Card className="info-card">
              <List header="Activity">
                <List.Item
                  prefix={<SwapOutlined style={{ fontSize: 20, color: '#722ed1' }} />}
                  extra={analytics?.issuances.total || 0}
                  arrow
                  onClick={() => {/* TODO: Navigate to issuances */}}
                >
                  Issuance History
                </List.Item>
              </List>
            </Card>

            <div className="coming-soon">
              <p>Full item management coming soon. Use the desktop view for full functionality.</p>
            </div>
          </div>
        )}

        {activeTab === 'location' && (
          <div className="location-tab">
            <Card className="info-card">
              <List header="Location Details">
                <List.Item
                  description="Address"
                >
                  {kit.location_address || 'Not specified'}
                </List.Item>
                <List.Item extra={kit.location_city || 'N/A'}>
                  City
                </List.Item>
                <List.Item extra={kit.location_state || 'N/A'}>
                  State
                </List.Item>
                <List.Item extra={kit.location_zip || 'N/A'}>
                  ZIP Code
                </List.Item>
                <List.Item extra={kit.location_country || 'N/A'}>
                  Country
                </List.Item>
              </List>
            </Card>

            {(kit.latitude !== null && kit.latitude !== undefined &&
              kit.longitude !== null && kit.longitude !== undefined) && (
              <Card className="info-card">
                <List header="Coordinates">
                  <List.Item extra={kit.latitude?.toFixed(6)}>
                    Latitude
                  </List.Item>
                  <List.Item extra={kit.longitude?.toFixed(6)}>
                    Longitude
                  </List.Item>
                </List>
              </Card>
            )}

            {kit.trailer_number && (
              <Card className="info-card">
                <List header="Additional Info">
                  <List.Item extra={kit.trailer_number}>
                    Trailer Number
                  </List.Item>
                </List>
              </Card>
            )}

            {kit.location_notes && (
              <Card className="info-card">
                <List header="Location Notes">
                  <List.Item>
                    <div className="notes-text">{kit.location_notes}</div>
                  </List.Item>
                </List>
              </Card>
            )}

            {!kit.has_location && (
              <div className="empty-location">
                <EnvironmentOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />
                <p>No location set for this kit</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'more' && (
          <div className="more-tab">
            <Card className="info-card">
              <List header="Additional Features">
                <List.Item
                  prefix={<ShoppingCartOutlined style={{ fontSize: 20, color: '#faad14' }} />}
                  extra={
                    analytics?.reorders.pending ? (
                      <Badge content={analytics.reorders.pending} />
                    ) : null
                  }
                  arrow
                >
                  Pending Reorders
                </List.Item>
                <List.Item
                  prefix={<MessageOutlined style={{ fontSize: 20, color: '#1890ff' }} />}
                  extra={
                    kit.unread_messages ? (
                      <Badge content={kit.unread_messages} />
                    ) : null
                  }
                  arrow
                >
                  Messages
                </List.Item>
                <List.Item
                  prefix={<BarChartOutlined style={{ fontSize: 20, color: '#722ed1' }} />}
                  arrow
                >
                  Analytics
                </List.Item>
              </List>
            </Card>

            <div className="coming-soon">
              <p>These features are coming soon to mobile. Use the desktop view for full functionality.</p>
            </div>
          </div>
        )}
      </div>

      {/* More Actions Popup */}
      <Popup
        visible={showMorePopup}
        onMaskClick={() => setShowMorePopup(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
      >
        <div className="more-popup">
          <div className="popup-header">Actions</div>
          <List>
            <List.Item
              prefix={<EditOutlined style={{ color: '#1890ff' }} />}
              onClick={() => {
                setShowMorePopup(false);
                setIsEditModalOpen(true);
              }}
              arrow={false}
            >
              Edit Kit
            </List.Item>
            <List.Item
              prefix={<CopyOutlined style={{ color: '#52c41a' }} />}
              onClick={() => {
                setShowMorePopup(false);
                navigate(`/kits/${kit.id}/duplicate`);
              }}
              arrow={false}
            >
              Duplicate Kit
            </List.Item>
            <List.Item
              prefix={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
              onClick={() => {
                setShowMorePopup(false);
                handleDelete();
              }}
              arrow={false}
            >
              <span style={{ color: '#ff4d4f' }}>
                {isDeleting ? 'Deleting...' : 'Delete Kit'}
              </span>
            </List.Item>
          </List>
          <div className="popup-cancel">
            <Button block onClick={() => setShowMorePopup(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Popup>

      {/* Edit Kit Modal */}
      <EditKitModal
        open={isEditModalOpen}
        kit={kit}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
