import { useState } from 'react';
import { Typography, Button, Space } from 'antd';
import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { ToolsTable } from '../components/ToolsTable';
import { ToolDrawer } from '../components/ToolDrawer';
import { QuickCheckoutModal } from '@features/tool-checkout/components/QuickCheckoutModal';
import { MobileToolsList } from '../components/mobile';
import { useIsMobile } from '@shared/hooks/useMobile';
import { PermissionGuard } from '@features/auth/components/PermissionGuard';
import type { Tool } from '../types';

const { Title } = Typography;

export const ToolsPage = () => {
  const isMobile = useIsMobile();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileToolsList />;
  }

  const handleView = (tool: Tool) => {
    setSelectedTool(tool);
    setDrawerMode('view');
  };

  const handleEdit = (tool: Tool) => {
    setSelectedTool(tool);
    setDrawerMode('edit');
  };

  const handleCreate = () => {
    setSelectedTool(null);
    setDrawerMode('create');
  };

  const handleCloseDrawer = () => {
    setDrawerMode(null);
    setSelectedTool(null);
  };

  return (
    <div data-testid="tools-page">
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
          <PermissionGuard permission="checkout.create">
            <Button
              icon={<SwapOutlined />}
              onClick={() => setCheckoutModalOpen(true)}
              data-testid="tools-checkout-button"
            >
              Checkout
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="tool.create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              data-testid="tools-create-button"
            >
              Add Tool
            </Button>
          </PermissionGuard>
        </Space>
      </div>

      <ToolsTable onView={handleView} onEdit={handleEdit} />

      <ToolDrawer
        open={drawerMode !== null}
        mode={drawerMode || 'view'}
        toolId={selectedTool?.id}
        onClose={handleCloseDrawer}
      />

      <QuickCheckoutModal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
      />
    </div>
  );
};
