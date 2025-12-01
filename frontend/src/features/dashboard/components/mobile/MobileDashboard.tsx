import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Grid,
  NoticeBar,
  Skeleton,
  Tag,
  List,
  Space,
  DotLoading,
  Badge,
} from 'antd-mobile';
import {
  RightOutline,
  ExclamationCircleOutline,
  ClockCircleOutline,
} from 'antd-mobile-icons';
import {
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  HomeOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useAppSelector } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';

// API hooks
import { useGetToolsQuery } from '@features/tools/services/toolsApi';
import { useGetChemicalsQuery } from '@features/chemicals/services/chemicalsApi';
import { useGetKitsQuery, useGetRecentKitActivityQuery, useGetReorderReportQuery } from '@features/kits/services/kitsApi';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import { useGetAnnouncementsQuery } from '@features/admin/services/adminApi';

import './MobileDashboard.css';

export const MobileDashboard = () => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  // Fetch data
  const { data: toolsData, isLoading: toolsLoading } = useGetToolsQuery({ per_page: 1000 });
  const { data: chemicalsData, isLoading: chemicalsLoading } = useGetChemicalsQuery({ per_page: 1000 });
  const { data: kitsData, isLoading: kitsLoading } = useGetKitsQuery();
  const { data: warehousesData, isLoading: warehousesLoading } = useGetWarehousesQuery();
  const { data: announcements } = useGetAnnouncementsQuery();
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentKitActivityQuery({ limit: 5 });
  const { data: pendingReorders } = useGetReorderReportQuery({ status: 'pending' });

  // Calculate tool stats
  const toolStats = useMemo(() => {
    const tools = toolsData?.tools || [];
    return {
      total: toolsData?.total || 0,
      available: tools.filter((t) => t.status === 'available').length,
      checkedOut: tools.filter((t) => t.status === 'checked_out').length,
      maintenance: tools.filter((t) => t.status === 'maintenance').length,
      calibrationDue: tools.filter((t) => t.calibration_status === 'due_soon').length,
      calibrationOverdue: tools.filter((t) => t.calibration_status === 'overdue').length,
    };
  }, [toolsData]);

  // Calculate chemical stats
  const chemicalStats = useMemo(() => {
    const chemicals = chemicalsData?.chemicals || [];
    return {
      total: chemicalsData?.pagination?.total || 0,
      available: chemicals.filter((c) => c.status === 'available').length,
      lowStock: chemicals.filter((c) => c.status === 'low_stock').length,
      outOfStock: chemicals.filter((c) => c.status === 'out_of_stock').length,
      expired: chemicals.filter((c) => c.status === 'expired').length,
      expiringSoon: chemicals.filter((c) => c.expiring_soon).length,
    };
  }, [chemicalsData]);

  // Calculate kit stats
  const kitStats = useMemo(() => {
    const kits = kitsData || [];
    return {
      total: kits.length,
      active: kits.filter((k) => k.status === 'active').length,
      pendingReorders: pendingReorders?.length || 0,
    };
  }, [kitsData, pendingReorders]);

  // Calculate alert count
  const alertCount = useMemo(() => {
    let count = 0;
    if (toolStats.calibrationOverdue > 0) count++;
    if (chemicalStats.expired > 0) count++;
    if (chemicalStats.outOfStock > 0) count++;
    if (chemicalStats.lowStock > 0) count++;
    if (toolStats.calibrationDue > 0) count++;
    if (chemicalStats.expiringSoon > 0) count++;
    return count;
  }, [toolStats, chemicalStats]);

  // Get active announcement
  const activeAnnouncement = announcements?.[0];

  const isLoading = toolsLoading || chemicalsLoading || kitsLoading || warehousesLoading;

  // Stat card data
  const statsData = [
    {
      label: 'Tools',
      value: toolStats.total,
      icon: <ToolOutlined />,
      color: '#1890ff',
      loading: toolsLoading,
      path: ROUTES.TOOLS,
      badge: toolStats.checkedOut > 0 ? `${toolStats.checkedOut} out` : undefined,
    },
    {
      label: 'Chemicals',
      value: chemicalStats.total,
      icon: <ExperimentOutlined />,
      color: '#52c41a',
      loading: chemicalsLoading,
      path: ROUTES.CHEMICALS,
      badge: chemicalStats.lowStock > 0 ? `${chemicalStats.lowStock} low` : undefined,
      badgeColor: '#faad14',
    },
    {
      label: 'Kits',
      value: kitStats.active,
      icon: <InboxOutlined />,
      color: '#722ed1',
      loading: kitsLoading,
      path: ROUTES.KITS,
    },
    {
      label: 'Warehouses',
      value: warehousesData?.warehouses?.length || 0,
      icon: <HomeOutlined />,
      color: '#fa8c16',
      loading: warehousesLoading,
      path: ROUTES.WAREHOUSES,
    },
  ];

  // Alert stats data
  const alertStats = [
    {
      label: 'Calibration',
      value: toolStats.calibrationDue + toolStats.calibrationOverdue,
      icon: <ClockCircleOutlined />,
      color: toolStats.calibrationOverdue > 0 ? '#ff4d4f' : '#faad14',
      path: ROUTES.TOOLS + '?calibration_status=due_soon',
    },
    {
      label: 'Expiring',
      value: chemicalStats.expiringSoon + chemicalStats.expired,
      icon: <WarningOutlined />,
      color: chemicalStats.expired > 0 ? '#ff4d4f' : '#faad14',
      path: ROUTES.CHEMICALS,
    },
    {
      label: 'Low Stock',
      value: chemicalStats.lowStock + chemicalStats.outOfStock,
      icon: <AlertOutlined />,
      color: chemicalStats.outOfStock > 0 ? '#ff4d4f' : '#faad14',
      path: ROUTES.CHEMICALS + '?status=low_stock',
    },
    {
      label: 'Reorders',
      value: kitStats.pendingReorders,
      icon: <ShoppingCartOutlined />,
      color: '#1890ff',
      path: ROUTES.KITS,
    },
  ];

  // Quick actions
  const quickActions = [
    {
      label: 'Check Out Tool',
      icon: <SwapOutlined style={{ fontSize: 24 }} />,
      path: ROUTES.TOOL_CHECKOUT,
    },
    {
      label: 'New Order',
      icon: <PlusOutlined style={{ fontSize: 24 }} />,
      path: '/orders/new',
    },
    {
      label: 'New Kit',
      icon: <InboxOutlined style={{ fontSize: 24 }} />,
      path: '/kits/new',
    },
    {
      label: 'Reports',
      icon: <AlertOutlined style={{ fontSize: 24 }} />,
      path: ROUTES.REPORTS,
    },
  ];

  return (
    <div className="mobile-dashboard">
      {/* Welcome Section */}
      <div className="mobile-welcome">
        <div className="welcome-text">
          <h2>Welcome back, {user?.name?.split(' ')[0] || 'User'}</h2>
          <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        {alertCount > 0 && (
          <Badge content={alertCount} style={{ '--right': '0', '--top': '0' }}>
            <div className="alert-badge" onClick={() => navigate(ROUTES.TOOLS)}>
              <ExclamationCircleOutline fontSize={20} />
            </div>
          </Badge>
        )}
      </div>

      {/* Announcement Banner */}
      {activeAnnouncement && (
        <NoticeBar
          content={activeAnnouncement.title}
          color={activeAnnouncement.priority === 'urgent' ? 'error' : 'info'}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Stats Grid */}
      <div className="section-title">Inventory Overview</div>
      <Grid columns={2} gap={12}>
        {statsData.map((stat) => (
          <Grid.Item key={stat.label}>
            <Card className="stat-card" onClick={() => navigate(stat.path)}>
              {stat.loading ? (
                <Skeleton.Paragraph lineCount={2} animated />
              ) : (
                <>
                  <div className="stat-icon" style={{ color: stat.color, background: `${stat.color}15` }}>
                    {stat.icon}
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                  {stat.badge && (
                    <Tag color={stat.badgeColor === '#faad14' ? 'warning' : 'primary'} className="stat-badge">
                      {stat.badge}
                    </Tag>
                  )}
                </>
              )}
            </Card>
          </Grid.Item>
        ))}
      </Grid>

      {/* Alert Stats */}
      <div className="section-title" style={{ marginTop: 20 }}>Alerts & Warnings</div>
      <div className="alert-stats-row">
        {alertStats.map((stat) => (
          <div
            key={stat.label}
            className="alert-stat-item"
            onClick={() => navigate(stat.path)}
            style={{ borderColor: stat.value > 0 ? stat.color : 'transparent' }}
          >
            <div className="alert-stat-icon" style={{ color: stat.color }}>
              {stat.icon}
            </div>
            <div className="alert-stat-value" style={{ color: stat.value > 0 ? stat.color : undefined }}>
              {isLoading ? <DotLoading /> : stat.value}
            </div>
            <div className="alert-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="section-title" style={{ marginTop: 20 }}>Quick Actions</div>
      <Grid columns={4} gap={8}>
        {quickActions.map((action) => (
          <Grid.Item key={action.label}>
            <div className="quick-action" onClick={() => navigate(action.path)}>
              <div className="quick-action-icon">{action.icon}</div>
              <div className="quick-action-label">{action.label}</div>
            </div>
          </Grid.Item>
        ))}
      </Grid>

      {/* Recent Activity */}
      <div className="section-title" style={{ marginTop: 20 }}>
        <span>Recent Activity</span>
        <RightOutline
          className="section-more"
          onClick={() => navigate(ROUTES.KITS)}
        />
      </div>
      <Card className="activity-card">
        {activityLoading ? (
          <Skeleton.Paragraph lineCount={3} animated />
        ) : recentActivity && recentActivity.length > 0 ? (
          <List>
            {recentActivity.slice(0, 5).map((activity, index) => (
              <List.Item
                key={index}
                prefix={
                  <ClockCircleOutline
                    style={{ fontSize: 20, color: 'var(--adm-color-primary)' }}
                  />
                }
                description={
                  <Space>
                    <span>{activity.user_name || 'Unknown'}</span>
                    <span style={{ color: 'var(--adm-color-text-secondary)' }}>
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </span>
                  </Space>
                }
              >
                {activity.type?.replace(/_/g, ' ') || 'Activity'}
                {activity.kit_name && ` - ${activity.kit_name}`}
              </List.Item>
            ))}
          </List>
        ) : (
          <div className="empty-state">
            <p>No recent activity</p>
          </div>
        )}
      </Card>
    </div>
  );
};
