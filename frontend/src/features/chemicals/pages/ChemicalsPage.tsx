import { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Space, Tooltip } from 'antd';
import { PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { ChemicalsTable } from '../components/ChemicalsTable';
import { ChemicalDrawer } from '../components/ChemicalDrawer';
import { ChemicalIssuanceModal } from '../components/ChemicalIssuanceModal';
import { MobileChemicalsList } from '../components/mobile';
import { useIsMobile } from '@shared/hooks/useMobile';
import { useHotkeyContext } from '@shared/contexts/HotkeyContext';
import { CHEMICALS_HOTKEYS, formatHotkey } from '@shared/constants/hotkeys';
import type { Chemical } from '../types';

const { Title } = Typography;

export const ChemicalsPage = () => {
  const isMobile = useIsMobile();
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [issuanceModalOpen, setIssuanceModalOpen] = useState(false);
  const [chemicalToIssue, setChemicalToIssue] = useState<Chemical | null>(null);
  const { registerHotkey, unregisterScope, setActiveScope, showHelp } = useHotkeyContext();

  const handleView = (chemical: Chemical) => {
    setSelectedChemical(chemical);
    setDrawerMode('view');
  };

  const handleEdit = (chemical: Chemical) => {
    setSelectedChemical(chemical);
    setDrawerMode('edit');
  };

  const handleCreate = useCallback(() => {
    setSelectedChemical(null);
    setDrawerMode('create');
  }, []);

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

  // Register page-specific hotkeys
  useEffect(() => {
    if (isMobile) return;

    setActiveScope('chemicals');

    // Ctrl+A to add new chemical
    registerHotkey('chemicals', CHEMICALS_HOTKEYS.ADD_CHEMICAL, handleCreate);

    return () => {
      unregisterScope('chemicals');
      setActiveScope('global');
    };
  }, [registerHotkey, unregisterScope, setActiveScope, handleCreate, isMobile]);

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileChemicalsList />;
  }

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
          <Tooltip title={`Add Chemical (${formatHotkey(CHEMICALS_HOTKEYS.ADD_CHEMICAL)})`}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Add Chemical
            </Button>
          </Tooltip>
          <Tooltip title="Keyboard shortcuts (Shift+?)">
            <Button icon={<QuestionCircleOutlined />} onClick={showHelp} />
          </Tooltip>
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
