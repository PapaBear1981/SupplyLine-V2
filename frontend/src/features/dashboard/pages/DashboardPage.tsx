import { useMemo } from 'react';
import { Row, Col, Spin } from 'antd';
import {
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  HomeOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@app/hooks';
import { useTheme } from '@features/settings/contexts/ThemeContext';
import { COLOR_THEMES } from '@features/settings/types/theme';
import { ROUTES } from '@shared/constants/routes';
import { KitLocationMap } from '@features/kits';
import { useIsMobile } from '@shared/hooks/useMobile';

// API hooks
import { useGetToolsQuery } from '@features/tools/services/toolsApi';
import { useGetChemicalsQuery } from '@features/chemicals/services/chemicalsApi';
import { useGetKitsQuery, useGetRecentKitActivityQuery, useGetKitUtilizationAnalyticsQuery, useGetReorderReportQuery } from '@features/kits/services/kitsApi';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import { useGetAnnouncementsQuery, useGetOnlineUsersQuery } from '@features/admin/services/adminApi';

// Components
import {
  WelcomeCard,
  StatCard,
  AlertsPanel,
  RecentActivity,
  InventoryPieChart,
  ActivityChart,
  QuickActions,
  AnnouncementsPanel,
} from '../components';
import { MobileDashboard } from '../components/mobile';

// Types
import type { DashboardAlert } from '../types';

// Styles
import styles from '../styles/Dashboard.module.scss';

export const DashboardPage = () => {
  const isMobile = useIsMobile();

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileDashboard />;
  }
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const { themeConfig } = useTheme();
  const primaryColor = COLOR_THEMES[themeConfig.colorTheme].primary;

  // Fetch data
  const { data: toolsData, isLoading: toolsLoading, refetch: refetchTools } = useGetToolsQuery({ per_page: 1000 });
  const { data: chemicalsData, isLoading: chemicalsLoading, refetch: refetchChemicals } = useGetChemicalsQuery({ per_page: 1000 });
  const { data: kitsData, isLoading: kitsLoading, refetch: refetchKits } = useGetKitsQuery();
  const { data: warehousesData, isLoading: warehousesLoading } = useGetWarehousesQuery();
  const { data: onlineUsersData } = useGetOnlineUsersQuery(undefined, { pollingInterval: 30000 }); // Poll every 30 seconds
  const { data: announcements, isLoading: announcementsLoading } = useGetAnnouncementsQuery();
  const { data: recentActivity, isLoading: activityLoading, refetch: refetchActivity } = useGetRecentKitActivityQuery({ limit: 10 });
  const { data: utilizationData, isLoading: utilizationLoading } = useGetKitUtilizationAnalyticsQuery({ days: 14 });
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

  // Generate alerts
  const alerts = useMemo<DashboardAlert[]>(() => {
    const alertsList: DashboardAlert[] = [];

    // Calibration overdue alerts (highest priority)
    if (toolStats.calibrationOverdue > 0) {
      alertsList.push({
        id: 'calibration-overdue',
        type: 'calibration_overdue',
        severity: 'error',
        title: 'Calibration Overdue',
        description: `${toolStats.calibrationOverdue} tool(s) have overdue calibration that requires immediate attention.`,
        count: toolStats.calibrationOverdue,
        link: ROUTES.TOOLS + '?calibration_status=overdue',
      });
    }

    // Expired chemicals
    if (chemicalStats.expired > 0) {
      alertsList.push({
        id: 'chemicals-expired',
        type: 'expired',
        severity: 'error',
        title: 'Expired Chemicals',
        description: `${chemicalStats.expired} chemical(s) have expired and should be disposed of properly.`,
        count: chemicalStats.expired,
        link: ROUTES.CHEMICALS + '?status=expired',
      });
    }

    // Out of stock chemicals
    if (chemicalStats.outOfStock > 0) {
      alertsList.push({
        id: 'chemicals-oos',
        type: 'low_stock',
        severity: 'error',
        title: 'Out of Stock',
        description: `${chemicalStats.outOfStock} chemical(s) are completely out of stock.`,
        count: chemicalStats.outOfStock,
        link: ROUTES.CHEMICALS + '?status=out_of_stock',
      });
    }

    // Low stock chemicals
    if (chemicalStats.lowStock > 0) {
      alertsList.push({
        id: 'chemicals-low',
        type: 'low_stock',
        severity: 'warning',
        title: 'Low Stock Warning',
        description: `${chemicalStats.lowStock} chemical(s) are running low on stock.`,
        count: chemicalStats.lowStock,
        link: ROUTES.CHEMICALS + '?status=low_stock',
      });
    }

    // Calibration due soon
    if (toolStats.calibrationDue > 0) {
      alertsList.push({
        id: 'calibration-due',
        type: 'calibration_due',
        severity: 'warning',
        title: 'Calibration Due Soon',
        description: `${toolStats.calibrationDue} tool(s) have calibration due within the next 30 days.`,
        count: toolStats.calibrationDue,
        link: ROUTES.TOOLS + '?calibration_status=due_soon',
      });
    }

    // Expiring soon chemicals
    if (chemicalStats.expiringSoon > 0) {
      alertsList.push({
        id: 'chemicals-expiring',
        type: 'expiring_soon',
        severity: 'warning',
        title: 'Chemicals Expiring Soon',
        description: `${chemicalStats.expiringSoon} chemical(s) will expire within 30 days.`,
        count: chemicalStats.expiringSoon,
        link: ROUTES.CHEMICALS,
      });
    }

    // Pending reorders
    if (kitStats.pendingReorders > 0) {
      alertsList.push({
        id: 'pending-reorders',
        type: 'pending_reorder',
        severity: 'info',
        title: 'Pending Reorder Requests',
        description: `${kitStats.pendingReorders} reorder request(s) are awaiting approval.`,
        count: kitStats.pendingReorders,
        link: ROUTES.KITS,
      });
    }

    // Tools in maintenance
    if (toolStats.maintenance > 0) {
      alertsList.push({
        id: 'tools-maintenance',
        type: 'low_stock',
        severity: 'info',
        title: 'Tools in Maintenance',
        description: `${toolStats.maintenance} tool(s) are currently undergoing maintenance.`,
        count: toolStats.maintenance,
        link: ROUTES.TOOLS + '?status=maintenance',
      });
    }

    return alertsList;
  }, [toolStats, chemicalStats, kitStats]);

  // Chart data
  const toolStatusChartData = useMemo(() => [
    { name: 'Available', value: toolStats.available, color: '#52c41a' },
    { name: 'Checked Out', value: toolStats.checkedOut, color: '#1890ff' },
    { name: 'Maintenance', value: toolStats.maintenance, color: '#faad14' },
  ].filter(item => item.value > 0), [toolStats]);

  const chemicalStatusChartData = useMemo(() => [
    { name: 'Available', value: chemicalStats.available, color: '#52c41a' },
    { name: 'Low Stock', value: chemicalStats.lowStock, color: '#faad14' },
    { name: 'Out of Stock', value: chemicalStats.outOfStock, color: '#ff4d4f' },
    { name: 'Expired', value: chemicalStats.expired, color: '#8c8c8c' },
  ].filter(item => item.value > 0), [chemicalStats]);

  const activityChartData = useMemo(() => {
    return utilizationData?.activityOverTime || [];
  }, [utilizationData]);

  const handleRefreshAlerts = () => {
    refetchTools();
    refetchChemicals();
    refetchKits();
  };

  const isLoading = toolsLoading || chemicalsLoading || kitsLoading || warehousesLoading;

  if (isLoading && !toolsData && !chemicalsData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Welcome Section */}
      <div className={styles.welcomeSection}>
        <WelcomeCard
          user={user}
          onlineUsersCount={onlineUsersData?.online_count || 0}
          primaryColor={primaryColor}
        />
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard
          title="Total Tools"
          value={toolStats.total}
          icon={<ToolOutlined />}
          iconBg="rgba(24, 144, 255, 0.1)"
          iconColor="#1890ff"
          loading={toolsLoading}
          onClick={() => navigate(ROUTES.TOOLS)}
          trend={toolStats.checkedOut > 0 ? { value: toolStats.checkedOut, label: 'checked out', type: 'neutral' } : undefined}
        />
        <StatCard
          title="Chemicals"
          value={chemicalStats.total}
          icon={<ExperimentOutlined />}
          iconBg="rgba(82, 196, 26, 0.1)"
          iconColor="#52c41a"
          loading={chemicalsLoading}
          onClick={() => navigate(ROUTES.CHEMICALS)}
          trend={chemicalStats.lowStock > 0 ? { value: chemicalStats.lowStock, label: 'low stock', type: 'warning' as const } : undefined}
        />
        <StatCard
          title="Active Kits"
          value={kitStats.active}
          icon={<InboxOutlined />}
          iconBg="rgba(114, 46, 209, 0.1)"
          iconColor="#722ed1"
          loading={kitsLoading}
          onClick={() => navigate(ROUTES.KITS)}
          trend={kitStats.pendingReorders > 0 ? { value: kitStats.pendingReorders, label: 'pending reorders', type: 'warning' as const } : undefined}
        />
        <StatCard
          title="Warehouses"
          value={warehousesData?.warehouses?.length || 0}
          icon={<HomeOutlined />}
          iconBg="rgba(250, 140, 22, 0.1)"
          iconColor="#fa8c16"
          loading={warehousesLoading}
          onClick={() => navigate(ROUTES.WAREHOUSES)}
        />
      </div>

      {/* Alert Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard
            title="Calibration Due"
            value={toolStats.calibrationDue + toolStats.calibrationOverdue}
            icon={<ClockCircleOutlined />}
            iconBg={toolStats.calibrationOverdue > 0 ? "rgba(255, 77, 79, 0.1)" : "rgba(250, 173, 20, 0.1)"}
            iconColor={toolStats.calibrationOverdue > 0 ? "#ff4d4f" : "#faad14"}
            loading={toolsLoading}
            onClick={() => navigate(ROUTES.TOOLS + '?calibration_status=due_soon')}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Expiring Soon"
            value={chemicalStats.expiringSoon + chemicalStats.expired}
            icon={<WarningOutlined />}
            iconBg={chemicalStats.expired > 0 ? "rgba(255, 77, 79, 0.1)" : "rgba(250, 173, 20, 0.1)"}
            iconColor={chemicalStats.expired > 0 ? "#ff4d4f" : "#faad14"}
            loading={chemicalsLoading}
            onClick={() => navigate(ROUTES.CHEMICALS)}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Low Stock Items"
            value={chemicalStats.lowStock + chemicalStats.outOfStock}
            icon={<AlertOutlined />}
            iconBg={chemicalStats.outOfStock > 0 ? "rgba(255, 77, 79, 0.1)" : "rgba(250, 173, 20, 0.1)"}
            iconColor={chemicalStats.outOfStock > 0 ? "#ff4d4f" : "#faad14"}
            loading={chemicalsLoading}
            onClick={() => navigate(ROUTES.CHEMICALS + '?status=low_stock')}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Pending Reorders"
            value={kitStats.pendingReorders}
            icon={<ShoppingCartOutlined />}
            iconBg="rgba(24, 144, 255, 0.1)"
            iconColor="#1890ff"
            loading={kitsLoading}
            onClick={() => navigate(ROUTES.KITS)}
          />
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={8}>
          <InventoryPieChart
            title="Tool Status"
            data={toolStatusChartData}
            loading={toolsLoading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <InventoryPieChart
            title="Chemical Status"
            data={chemicalStatusChartData}
            loading={chemicalsLoading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <ActivityChart
            title="Activity (Last 14 Days)"
            data={activityChartData}
            loading={utilizationLoading}
          />
        </Col>
      </Row>

      {/* Kit Location Map */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <KitLocationMap height={400} />
        </Col>
      </Row>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          {/* Alerts Panel */}
          <AlertsPanel
            alerts={alerts}
            loading={isLoading}
            onRefresh={handleRefreshAlerts}
          />

          {/* Quick Actions */}
          <QuickActions isAdmin={user?.is_admin} />
        </div>

        <div className={styles.sideColumn}>
          {/* Recent Activity */}
          <RecentActivity
            activities={recentActivity || []}
            loading={activityLoading}
            onRefresh={refetchActivity}
          />

          {/* Announcements */}
          <AnnouncementsPanel
            announcements={announcements || []}
            loading={announcementsLoading}
          />
        </div>
      </div>
    </div>
  );
};
