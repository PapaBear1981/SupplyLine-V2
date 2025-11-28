import { Card, Col, Row, Statistic } from 'antd';
import {
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  HomeOutlined,
} from '@ant-design/icons';

export interface DashboardStats {
  totalTools: number;
  totalChemicals: number;
  activeKits: number;
  totalWarehouses: number;
}

interface StatsCardsProps {
  stats?: DashboardStats;
  loading?: boolean;
}

export const StatsCards = ({ stats, loading = false }: StatsCardsProps) => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Card loading={loading}>
          <Statistic
            title="Total Tools"
            value={stats?.totalTools || 0}
            prefix={<ToolOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card loading={loading}>
          <Statistic
            title="Chemicals"
            value={stats?.totalChemicals || 0}
            prefix={<ExperimentOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card loading={loading}>
          <Statistic
            title="Active Kits"
            value={stats?.activeKits || 0}
            prefix={<InboxOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card loading={loading}>
          <Statistic
            title="Warehouses"
            value={stats?.totalWarehouses || 0}
            prefix={<HomeOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
};
