import { useState } from 'react';
import { Typography, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ChemicalsTable } from '../components/ChemicalsTable';
import { ChemicalDrawer } from '../components/ChemicalDrawer';
import { ChemicalIssuanceModal } from '../components/ChemicalIssuanceModal';
import type { Chemical } from '../types';

const { Title } = Typography;

export const ChemicalsPage = () => {
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [issuanceModalOpen, setIssuanceModalOpen] = useState(false);
  const [chemicalToIssue, setChemicalToIssue] = useState<Chemical | null>(null);

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
        <Title level={2} style={{ margin: 0 }}>
          Chemicals
        </Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Add Chemical
          </Button>
        </Space>
      </div>

      <ChemicalsTable onView={handleView} onEdit={handleEdit} onIssue={handleIssue} />

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
