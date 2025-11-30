import { useState } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Tabs,
  Badge,
  theme,
} from 'antd';
import {
  SwapOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  HistoryOutlined,
  UserOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useGetCheckoutStatsQuery } from '../services/checkoutApi';
import { QuickCheckoutModal } from '../components/QuickCheckoutModal';
import { ActiveCheckoutsTable } from '../components/ActiveCheckoutsTable';
import { MyCheckoutsTable } from '../components/MyCheckoutsTable';
import { OverdueCheckoutsTable } from '../components/OverdueCheckoutsTable';
import { CheckinModal } from '../components/CheckinModal';
import type { ToolCheckout } from '../types';

const { Title, Text } = Typography;

export const ToolCheckoutPage = () => {
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState('active');
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<ToolCheckout | null>(null);

  const { data: stats, isLoading: statsLoading } = useGetCheckoutStatsQuery();

  const handleCheckin = (checkout: ToolCheckout) => {
    setSelectedCheckout(checkout);
    setCheckinModalOpen(true);
  };

  const handleCheckinClose = () => {
    setCheckinModalOpen(false);
    setSelectedCheckout(null);
  };

  const tabItems = [
    {
      key: 'active',
      label: (
        <span>
          <SwapOutlined />
          Active Checkouts
          {stats && stats.active_checkouts > 0 && (
            <Badge
              count={stats.active_checkouts}
              style={{ marginLeft: 8 }}
              overflowCount={999}
            />
          )}
        </span>
      ),
      children: <ActiveCheckoutsTable onCheckin={handleCheckin} />,
    },
    {
      key: 'my',
      label: (
        <span>
          <UserOutlined />
          My Checkouts
        </span>
      ),
      children: <MyCheckoutsTable onCheckin={handleCheckin} />,
    },
    {
      key: 'overdue',
      label: (
        <span>
          <WarningOutlined />
          Overdue
          {stats && stats.overdue_checkouts > 0 && (
            <Badge
              count={stats.overdue_checkouts}
              style={{ marginLeft: 8, backgroundColor: token.colorError }}
              overflowCount={999}
            />
          )}
        </span>
      ),
      children: <OverdueCheckoutsTable onCheckin={handleCheckin} />,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Tool Checkout
          </Title>
          <Text type="secondary">
            Check out and return tools, view checkout history
          </Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setCheckoutModalOpen(true)}
        >
          Quick Checkout
        </Button>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="Active Checkouts"
              value={stats?.active_checkouts || 0}
              prefix={<SwapOutlined />}
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="Overdue"
              value={stats?.overdue_checkouts || 0}
              prefix={<WarningOutlined />}
              valueStyle={{
                color: stats?.overdue_checkouts ? token.colorError : token.colorSuccess,
              }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="Today's Checkouts"
              value={stats?.checkouts_today || 0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="Today's Returns"
              value={stats?.returns_today || 0}
              prefix={<HistoryOutlined />}
              valueStyle={{ color: token.colorSuccess }}
            />
          </Card>
        </Col>
      </Row>

      {/* Additional Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="Most Active Tools (30 days)" loading={statsLoading}>
            {stats?.popular_tools && stats.popular_tools.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {stats.popular_tools.slice(0, 5).map((tool, index) => (
                  <div
                    key={tool.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom:
                        index < 4 ? `1px solid ${token.colorBorderSecondary}` : 'none',
                    }}
                  >
                    <Text>
                      <Text strong>{tool.tool_number}</Text> - {tool.description}
                    </Text>
                    <Badge
                      count={tool.checkout_count}
                      style={{ backgroundColor: token.colorPrimary }}
                    />
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">No checkout data available</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Most Active Users (30 days)" loading={statsLoading}>
            {stats?.active_users && stats.active_users.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {stats.active_users.slice(0, 5).map((user, index) => (
                  <div
                    key={user.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom:
                        index < 4 ? `1px solid ${token.colorBorderSecondary}` : 'none',
                    }}
                  >
                    <Text>
                      <Text strong>{user.name}</Text>
                      {user.department && (
                        <Text type="secondary"> ({user.department})</Text>
                      )}
                    </Text>
                    <Badge
                      count={user.checkout_count}
                      style={{ backgroundColor: token.colorSuccess }}
                    />
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">No user data available</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Checkout Tables */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>

      {/* Quick Checkout Modal */}
      <QuickCheckoutModal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
      />

      {/* Check-in Modal */}
      <CheckinModal
        open={checkinModalOpen}
        checkout={selectedCheckout}
        onClose={handleCheckinClose}
      />
    </div>
  );
};

export default ToolCheckoutPage;
