import { useState } from 'react';
import { Typography, Button, Space, Segmented } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ChemicalsTable } from '../components/ChemicalsTable';
import { ChemicalPartsTable } from '../components/ChemicalPartsTable';
import { ChemicalDrawer } from '../components/ChemicalDrawer';
import { ChemicalIssuanceModal } from '../components/ChemicalIssuanceModal';
import { MobileChemicalsList } from '../components/mobile';
import { useIsMobile } from '@shared/hooks/useMobile';
import { PermissionGuard } from '@features/auth/components/PermissionGuard';
import type { Chemical } from '../types';

const { Title } = Typography;

type InventoryView = 'parts' | 'lots';

export const ChemicalsPage = () => {
  const isMobile = useIsMobile();
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [issuanceModalOpen, setIssuanceModalOpen] = useState(false);
  const [chemicalToIssue, setChemicalToIssue] = useState<Chemical | null>(null);
  const [view, setView] = useState<InventoryView>('parts');

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

  return (
    <div data-testid="chemicals-page">
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
          <Segmented<InventoryView>
            value={view}
            onChange={(value) => setView(value)}
            options={[
              { label: 'By Part Number', value: 'parts' },
              { label: 'By Lot', value: 'lots' },
            ]}
            data-testid="chemicals-view-toggle"
          />
          <PermissionGuard permission="chemical.create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              data-testid="chemicals-create-button"
            >
              Add Chemical
            </Button>
          </PermissionGuard>
        </Space>
      </div>

      {view === 'parts' ? (
        <ChemicalPartsTable
          onView={handleView}
          onEdit={handleEdit}
          onIssue={handleIssue}
        />
      ) : (
        <ChemicalsTable onView={handleView} onEdit={handleEdit} onIssue={handleIssue} />
      )}

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
