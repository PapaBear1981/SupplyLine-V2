import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Space,
  Button,
  Tag,
  List,
  Statistic,
  Row,
  Col,
  Skeleton,
  Avatar,
} from 'antd';
import {
  ArrowRightOutlined,
  DashboardOutlined,
  FormOutlined,
  InboxOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  ToolOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useAppSelector } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';
import { useGetToolsQuery } from '@features/tools/services/toolsApi';
import { useGetChemicalsQuery } from '@features/chemicals/services/chemicalsApi';
import { useGetKitsQuery, useGetRecentKitActivityQuery, useGetReorderReportQuery } from '@features/kits/services/kitsApi';
import { useGetAnnouncementsQuery } from '@features/admin/services/adminApi';
import { buildDashboardAlerts, type ToolStats, type ChemicalStats, type KitStats } from '../utils/buildDashboardAlerts';
import type { DashboardAlert } from '../types';
import styles from '../styles/MobileDashboard.module.scss';

const { Text, Title } = Typography;

export const MobileDashboardPage = () => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const { data: toolsData, isLoading: toolsLoading } = useGetToolsQuery({ per_page: 200 });
  const { data: chemicalsData, isLoading: chemicalsLoading } = useGetChemicalsQuery({ per_page: 200 });
  const { data: kitsData, isLoading: kitsLoading } = useGetKitsQuery();
  const { data: pendingReorders, isLoading: reordersLoading } = useGetReorderReportQuery({ status: 'pending' });
  const { data: recentActivity, isLoading: activityLoading } = useGetRecentKitActivityQuery({ limit: 6 });
  const { data: announcements, isLoading: announcementsLoading } = useGetAnnouncementsQuery();

  const toolStats = useMemo<ToolStats>(() => {
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

  const chemicalStats = useMemo<ChemicalStats>(() => {
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

  const kitStats = useMemo<KitStats>(() => {
    const kits = kitsData || [];
    return {
      total: kits.length,
      active: kits.filter((k) => k.status === 'active').length,
      pendingReorders: pendingReorders?.length || 0,
    };
  }, [kitsData, pendingReorders]);

  const alerts = useMemo<DashboardAlert[]>(
    () => buildDashboardAlerts({ toolStats, chemicalStats, kitStats }).slice(0, 4),
    [chemicalStats, kitStats, toolStats],
  );

  const quickLinks = [
    { label: 'Tool Checkout', icon: <SwapOutlined />, route: ROUTES.TOOL_CHECKOUT },
    { label: 'Kits', icon: <InboxOutlined />, route: ROUTES.KITS },
    { label: 'Chemicals', icon: <SafetyCertificateOutlined />, route: ROUTES.CHEMICALS },
    { label: 'Orders', icon: <ShoppingCartOutlined />, route: '/orders' },
    { label: 'Requests', icon: <FormOutlined />, route: '/requests' },
    { label: 'Reports', icon: <DashboardOutlined />, route: ROUTES.REPORTS },
  ];

  const statCards = [
    {
      label: 'Ready Tools',
      value: toolStats.available,
      total: toolStats.total,
      icon: <ToolOutlined />, 
      accent: styles.blue,
      route: ROUTES.TOOLS,
    },
    {
      label: 'Active Kits',
      value: kitStats.active,
      total: kitStats.total,
      icon: <InboxOutlined />, 
      accent: styles.purple,
      route: ROUTES.KITS,
    },
    {
      label: 'Chemicals Healthy',
      value: chemicalStats.available,
      total: chemicalStats.total,
      icon: <SafetyCertificateOutlined />, 
      accent: styles.green,
      route: ROUTES.CHEMICALS,
    },
  ];

  const isLoading = toolsLoading || chemicalsLoading || kitsLoading || reordersLoading;

  return (
    <div className={styles.mobileDashboard}>
      <Card className={styles.heroCard} bordered={false}>
        <Space direction="vertical" size="small">
          <Text type="secondary">Hi {user?.name || user?.employee_number}</Text>
          <Title level={3} className={styles.heroTitle}>
            Mobile command center
          </Title>
          <Text className={styles.heroCopy}>
            Quickly check tools, kits, and chemical readiness while you are on the move.
          </Text>
          <Space size="middle" className={styles.heroActions}>
            <Button type="primary" icon={<SwapOutlined />} onClick={() => navigate(ROUTES.TOOL_CHECKOUT)}>
              Start checkout
            </Button>
            <Button icon={<InboxOutlined />} onClick={() => navigate(ROUTES.KITS)}>
              Kits
            </Button>
          </Space>
          <div className={styles.heroTags}>
            <Tag color="blue">Live status</Tag>
            <Tag color="green">Touch friendly</Tag>
            <Tag color="purple">Fast actions</Tag>
          </div>
        </Space>
      </Card>

      <Card className={styles.quickCard} title="Shortcuts" bordered={false}>
        <div className={styles.quickGrid}>
          {quickLinks.map((link) => (
            <button
              key={link.route}
              className={styles.quickTile}
              type="button"
              onClick={() => navigate(link.route)}
            >
              <span className={styles.tileIcon}>{link.icon}</span>
              <span className={styles.tileLabel}>{link.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Row gutter={[12, 12]} className={styles.statRow}>
        {statCards.map((stat) => (
          <Col span={8} key={stat.label}>
            <Card
              className={styles.statCard}
              bordered={false}
              onClick={() => navigate(stat.route)}
              role="button"
              tabIndex={0}
            >
              <div className={`${styles.statIcon} ${stat.accent}`}>{stat.icon}</div>
              <Statistic value={stat.value} suffix={`/${stat.total}`} title={stat.label} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        className={styles.alertCard}
        title={
          <Space>
            <WarningOutlined />
            Alerts
          </Space>
        }
        bordered={false}
      >
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <List
            dataSource={alerts}
            locale={{ emptyText: 'No blocking issues right now.' }}
            renderItem={(alert) => (
              <List.Item
                className={styles.alertItem}
                onClick={() => navigate(alert.link)}
                actions={[<ArrowRightOutlined key="open" />]}
              >
                <List.Item.Meta
                  avatar={<Avatar size="large" icon={<WarningOutlined />} className={styles.alertIcon} />}
                  title={
                    <Space>
                      <Text strong>{alert.title}</Text>
                      <Tag color={alert.severity === 'error' ? 'red' : alert.severity === 'warning' ? 'orange' : 'blue'}>
                        {alert.count}
                      </Tag>
                    </Space>
                  }
                  description={alert.description}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card className={styles.activityCard} title="Recent kit activity" bordered={false}>
        {activityLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <List
            dataSource={recentActivity?.activities || []}
            locale={{ emptyText: 'No recent movements' }}
            renderItem={(activity) => (
              <List.Item className={styles.activityItem}>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={activity.summary}
                  description={activity.timestamp}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card className={styles.announcementsCard} title="Announcements" bordered={false}>
        {announcementsLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <List
            dataSource={announcements?.announcements?.slice(0, 3) || []}
            locale={{ emptyText: 'All clear' }}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={<Text strong>{item.title}</Text>}
                  description={<Text type="secondary">{item.content}</Text>}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};
