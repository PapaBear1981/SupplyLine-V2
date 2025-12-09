import { useState, useCallback } from 'react';
import { Typography, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ChemicalsTable } from '../components/ChemicalsTable';
import { ChemicalsFilters } from '../components/ChemicalsFilters';
import { ChemicalDrawer } from '../components/ChemicalDrawer';
import { ChemicalDetailsModal } from '../components/ChemicalDetailsModal';
import { ChemicalIssuanceModal } from '../components/ChemicalIssuanceModal';
import { MobileChemicalsList } from '../components/mobile';
import { useIsMobile } from '@shared/hooks/useMobile';
import type { Chemical, ChemicalStatus } from '../types';

const { Title } = Typography;

export const ChemicalsPage = () => {
  const isMobile = useIsMobile();
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);
  const [drawerMode, setDrawerMode] = useState<'edit' | 'create' | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [issuanceModalOpen, setIssuanceModalOpen] = useState(false);
  const [chemicalToIssue, setChemicalToIssue] = useState<Chemical | null>(null);

  // Filter state
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<ChemicalStatus | undefined>(undefined);
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileChemicalsList />;
  }

  const handleRowClick = useCallback((chemical: Chemical) => {
    setSelectedChemical(chemical);
    setDetailsModalOpen(true);
  }, []);

  const handleEdit = useCallback((chemical: Chemical) => {
    setSelectedChemical(chemical);
    setDrawerMode('edit');
  }, []);

  const handleCreate = useCallback(() => {
    setSelectedChemical(null);
    setDrawerMode('create');
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerMode(null);
    setSelectedChemical(null);
  }, []);

  const handleCloseDetailsModal = useCallback(() => {
    setDetailsModalOpen(false);
    setSelectedChemical(null);
  }, []);

  const handleIssue = useCallback((chemical: Chemical) => {
    // Close details modal if open (when issuing from within the modal)
    setDetailsModalOpen(false);
    setChemicalToIssue(chemical);
    setIssuanceModalOpen(true);
  }, []);

  const handleCloseIssuanceModal = useCallback(() => {
    setIssuanceModalOpen(false);
    setChemicalToIssue(null);
  }, []);

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

      <ChemicalsFilters
        category={category}
        status={status}
        warehouseId={warehouseId}
        showArchived={showArchived}
        onCategoryChange={setCategory}
        onStatusChange={setStatus}
        onWarehouseChange={setWarehouseId}
        onShowArchivedChange={setShowArchived}
      />

      <ChemicalsTable
        onRowClick={handleRowClick}
        onEdit={handleEdit}
        onIssue={handleIssue}
        category={category}
        status={status}
        warehouseId={warehouseId}
        showArchived={showArchived}
      />

      <ChemicalDetailsModal
        open={detailsModalOpen}
        chemical={selectedChemical}
        onClose={handleCloseDetailsModal}
        onIssue={handleIssue}
      />

      <ChemicalDrawer
        open={drawerMode !== null}
        mode={drawerMode || 'edit'}
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
