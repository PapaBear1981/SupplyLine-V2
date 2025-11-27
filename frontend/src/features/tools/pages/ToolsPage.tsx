import { useState } from 'react';
import { Typography, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ToolsTable } from '../components/ToolsTable';
import { ToolDrawer } from '../components/ToolDrawer';
import type { Tool } from '../types';

const { Title } = Typography;

export const ToolsPage = () => {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);

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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Add Tool
          </Button>
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
