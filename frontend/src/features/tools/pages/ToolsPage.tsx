import { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Space, Tooltip } from 'antd';
import { PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { ToolsTable } from '../components/ToolsTable';
import { ToolDrawer } from '../components/ToolDrawer';
import { MobileToolsList } from '../components/mobile';
import { useIsMobile } from '@shared/hooks/useMobile';
import { useHotkeyContext } from '@shared/contexts/HotkeyContext';
import { TOOLS_HOTKEYS, formatHotkey } from '@shared/constants/hotkeys';
import type { Tool } from '../types';

const { Title } = Typography;

export const ToolsPage = () => {
  const isMobile = useIsMobile();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const { registerHotkey, unregisterScope, setActiveScope, showHelp } = useHotkeyContext();

  const handleView = (tool: Tool) => {
    setSelectedTool(tool);
    setDrawerMode('view');
  };

  const handleEdit = (tool: Tool) => {
    setSelectedTool(tool);
    setDrawerMode('edit');
  };

  const handleCreate = useCallback(() => {
    setSelectedTool(null);
    setDrawerMode('create');
  }, []);

  const handleCloseDrawer = () => {
    setDrawerMode(null);
    setSelectedTool(null);
  };

  // Register page-specific hotkeys
  useEffect(() => {
    if (isMobile) return;

    setActiveScope('tools');

    // Ctrl+A to add new tool
    registerHotkey('tools', TOOLS_HOTKEYS.ADD_TOOL, handleCreate);

    return () => {
      unregisterScope('tools');
      setActiveScope('global');
    };
  }, [registerHotkey, unregisterScope, setActiveScope, handleCreate, isMobile]);

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileToolsList />;
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
          Tools
        </Title>
        <Space>
          <Tooltip title={`Add Tool (${formatHotkey(TOOLS_HOTKEYS.ADD_TOOL)})`}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              Add Tool
            </Button>
          </Tooltip>
          <Tooltip title="Keyboard shortcuts (Shift+?)">
            <Button icon={<QuestionCircleOutlined />} onClick={showHelp} />
          </Tooltip>
        </Space>
      </div>

      <ToolsTable onView={handleView} onEdit={handleEdit} />

      <ToolDrawer
        open={drawerMode !== null}
        mode={drawerMode || 'view'}
        toolId={selectedTool?.id}
        onClose={handleCloseDrawer}
      />
    </div>
  );
};
