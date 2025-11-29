import { Layout, Card, Typography, Tag, Space } from 'antd';
import { Outlet } from 'react-router-dom';
import {
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  CloudSyncOutlined,
} from '@ant-design/icons';
import './AuthLayout.css';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

export const AuthLayout = () => {
  return (
    <Layout className="auth-layout">
      <Content className="auth-shell">
        <div className="auth-panel">
          <Card className="auth-card" bordered={false}>
            <div className="auth-card-header">
              <div>
                <Title level={2} className="auth-card-title">
                  SupplyLine Access
                </Title>
                <Paragraph type="secondary" className="auth-card-subtitle">
                  Sign in to orchestrate sorties, replenish kits, and keep the line moving.
                </Paragraph>
              </div>
              <Tag color="green" className="status-tag">
                Operational
              </Tag>
            </div>
            <Outlet />
            <Paragraph type="secondary" className="auth-card-footer">
              Secure login with role-based access and audit-ready logging.
            </Paragraph>
          </Card>
        </div>

        <div className="auth-hero">
          <div className="auth-overlay" />
          <div className="hero-content">
            <div className="brand-badge">
              <span className="brand-mark">SupplyLine</span>
              <Text className="brand-subtitle">Aerial Firefighting MRO</Text>
            </div>

            <Title level={1} className="hero-title">
              Ready the fleet. Refill the line.
            </Title>
            <Paragraph className="hero-description">
              Coordinate parts, crews, and critical drops with a platform built for
              aerial firefighting and mission-ready maintenance teams.
            </Paragraph>

            <Space direction="vertical" size="middle" className="hero-highlights">
              <div className="highlight-card">
                <ThunderboltOutlined className="highlight-icon" />
                <div>
                  <Text strong>Rapid dispatch orchestration</Text>
                  <Paragraph type="secondary" className="highlight-copy">
                    Synchronize airbase inventory with live mission demand to keep tankers fueled and stocked.
                  </Paragraph>
                </div>
              </div>
              <div className="highlight-card">
                <SafetyCertificateOutlined className="highlight-icon" />
                <div>
                  <Text strong>Compliance-ready workflows</Text>
                  <Paragraph type="secondary" className="highlight-copy">
                    Built-in approvals and traceability so every component is signed off before the next sortie.
                  </Paragraph>
                </div>
              </div>
              <div className="highlight-card">
                <CloudSyncOutlined className="highlight-icon" />
                <div>
                  <Text strong>Live supply chain visibility</Text>
                  <Paragraph type="secondary" className="highlight-copy">
                    Monitor vendor lead times, staging sites, and field repairs from one synchronized cockpit.
                  </Paragraph>
                </div>
              </div>
            </Space>

            <div className="hero-tags">
              <Tag color="geekblue">Fireline Logistics</Tag>
              <Tag color="gold">Parts Traceability</Tag>
              <Tag color="cyan">Flight-Ready SLAs</Tag>
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
};
