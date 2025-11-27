import { Layout, Card, Typography } from 'antd';
import { Outlet } from 'react-router-dom';

const { Content } = Layout;
const { Title } = Typography;

export const AuthLayout = () => {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
        }}
      >
        <Card
          style={{
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={2}>SupplyLine MRO Suite</Title>
            <Typography.Text type="secondary">
              Maintenance, Repair & Operations Management
            </Typography.Text>
          </div>
          <Outlet />
        </Card>
      </Content>
    </Layout>
  );
};
