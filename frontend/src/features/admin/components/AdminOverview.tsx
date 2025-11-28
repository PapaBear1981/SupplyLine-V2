import { Row, Col, Card, Statistic, Spin, Alert } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  NotificationOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useGetAdminStatsQuery } from '../services/adminApi';

export const AdminOverview = () => {
  const { data: stats, isLoading, error } = useGetAdminStatsQuery();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Stats"
        description="Failed to load admin statistics. Please try again."
        type="error"
        showIcon
      />
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats?.total_users || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Active Users"
              value={stats?.active_users || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Locked Users"
              value={stats?.locked_users || 0}
              prefix={<LockOutlined />}
              valueStyle={{ color: stats?.locked_users ? '#ff4d4f' : '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Departments"
              value={stats?.total_departments || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Active Announcements"
              value={stats?.active_announcements || 0}
              prefix={<NotificationOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Roles"
              value={stats?.total_roles || 0}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
