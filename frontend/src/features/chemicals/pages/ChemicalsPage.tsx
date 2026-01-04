import { useState } from 'react';
import { Typography, Button, Space, Tabs, Badge, Card, Row, Col, Statistic } from 'antd';
import {
  PlusOutlined,
  ExperimentOutlined,
  DeleteOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { ChemicalsTable } from '../components/ChemicalsTable';
import { ChemicalDrawer } from '../components/ChemicalDrawer';
import { ChemicalIssuanceModal } from '../components/ChemicalIssuanceModal';
import { DisposedChemicalsTable } from '../components/DisposedChemicalsTable';
import { MobileChemicalsList } from '../components/mobile';
import { useIsMobile } from '@shared/hooks/useMobile';
import { useGetChemicalsQuery, useGetDisposedChemicalsQuery } from '../services/chemicalsApi';
import type { Chemical } from '../types';

const { Title, Text } = Typography;

export const ChemicalsPage = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('inventory');
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [issuanceModalOpen, setIssuanceModalOpen] = useState(false);
  const [chemicalToIssue, setChemicalToIssue] = useState<Chemical | null>(null);

  // Get stats for badges
  const { data: chemicalsData } = useGetChemicalsQuery({ per_page: 1000 });
  const { data: disposedData } = useGetDisposedChemicalsQuery({ per_page: 1 });

  // Calculate counts
  const totalActive = chemicalsData?.pagination.total || 0;
  const expiringSoonCount =
    chemicalsData?.chemicals.filter((c) => c.expiring_soon).length || 0;
  const lowStockCount =
    chemicalsData?.chemicals.filter((c) => c.status === 'low_stock').length || 0;
  const disposedCount = disposedData?.pagination.total || 0;

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileChemicalsList />;
  }

  const handleView = (chemical: Chemical) => {
    setSelectedChemical(chemical);
    setDrawerMode('view');
  };

  const handleEdit = (chemical: Chemical) => {
    setSelectedChemical(chemical);
    setDrawerMode('edit');
  };

  const handleCreate = () => {
    setSelectedChemical(null);
    setDrawerMode('create');
  };

  const handleCloseDrawer = () => {
    setDrawerMode(null);
    setSelectedChemical(null);
  };

  const handleIssue = (chemical: Chemical) => {
    setChemicalToIssue(chemical);
    setIssuanceModalOpen(true);
  };

  const handleCloseIssuanceModal = () => {
    setIssuanceModalOpen(false);
    setChemicalToIssue(null);
  };

  const tabItems = [
    {
      key: 'inventory',
      label: (
        <span>
          <ExperimentOutlined />
          Inventory
          {totalActive > 0 && (
            <Badge
              count={totalActive}
              style={{ marginLeft: 8, backgroundColor: '#1890ff' }}
              overflowCount={999}
            />
          )}
        </span>
      ),
      children: (
        <ChemicalsTable onView={handleView} onEdit={handleEdit} onIssue={handleIssue} />
      ),
    },
    {
      key: 'disposed',
      label: (
        <span>
          <DeleteOutlined />
          Disposed / Expired
          {disposedCount > 0 && (
            <Badge
              count={disposedCount}
              style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }}
              overflowCount={999}
            />
          )}
        </span>
      ),
      children: <DisposedChemicalsTable />,
    },
  ];

  return (
    <div>
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
            Chemicals
          </Title>
          <Text type="secondary">Manage chemical inventory, issuances, and disposal records</Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Add Chemical
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Active Inventory"
              value={totalActive}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Expiring Soon"
              value={expiringSoonCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: expiringSoonCount > 0 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Low Stock"
              value={lowStockCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: lowStockCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Disposed"
              value={disposedCount}
              prefix={<DeleteOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />

      <ChemicalDrawer
        open={drawerMode !== null}
        mode={drawerMode || 'view'}
        chemicalId={selectedChemical?.id}
        onClose={handleCloseDrawer}
        onSuccess={() => setSelectedChemical(null)}
      />

      <ChemicalIssuanceModal
        open={issuanceModalOpen}
        chemical={chemicalToIssue}
        onClose={handleCloseIssuanceModal}
      />
    </div>
  );
};
