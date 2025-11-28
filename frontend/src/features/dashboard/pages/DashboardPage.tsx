import { Typography, Row, Col, Card, Statistic } from 'antd';
import {
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { KitLocationMap } from '@features/kits';

const { Title } = Typography;

export const DashboardPage = () => {
  return (
    <div>
      <Title level={2}>Dashboard</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Tools"
              value={0}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Chemicals"
              value={0}
              prefix={<ExperimentOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Kits"
              value={0}
              prefix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Warehouses"
              value={0}
              prefix={<HomeOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Kit Location Map */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <KitLocationMap height={450} />
        </Col>
      </Row>
    </div>
  );
};
