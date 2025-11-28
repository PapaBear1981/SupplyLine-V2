import { Typography, Row, Col, Space } from 'antd';
import { StatsCards } from '../components/StatsCards';
import { RecentActivity } from '../components/RecentActivity';
import { QuickActions } from '../components/QuickActions';
import { AnnouncementsWidget } from '../components/AnnouncementsWidget';
import { AlertsWidget } from '../components/AlertsWidget';
import { ActiveUsersWidget } from '../components/ActiveUsersWidget';
import { ToolsDistributionChart } from '../components/ToolsDistributionChart';
import { useGetDashboardStatsQuery } from '../services/dashboardApi';

const { Title } = Typography;

export const DashboardPage = () => {
  const { data: stats, isLoading } = useGetDashboardStatsQuery();

  return (
    <div className="p-6">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
          <div style={{ width: 200 }}>
            <ActiveUsersWidget />
          </div>
        </div>

        <StatsCards stats={stats} loading={isLoading} />

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                  <AnnouncementsWidget />
                </Col>
                <Col xs={24} md={12}>
                  <AlertsWidget />
                </Col>
              </Row>
              <RecentActivity />
            </Space>
          </Col>

          <Col xs={24} lg={8}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <QuickActions />
              <ToolsDistributionChart />
            </Space>
          </Col>
        </Row>
      </Space>
    </div>
  );
};
