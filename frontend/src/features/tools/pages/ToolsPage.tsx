import { useState } from 'react';
import { Typography, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ToolsTable } from '../components/ToolsTable';
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

      {/* TODO: Add ToolDrawer component here */}
      {drawerMode && (
        <div style={{ padding: 16, background: '#f0f0f0', marginTop: 16 }}>
          <p>
            Drawer Mode: <strong>{drawerMode}</strong>
          </p>
          {selectedTool && (
            <p>
              Selected Tool: <strong>{selectedTool.tool_number}</strong> - {selectedTool.description}
            </p>
          )}
          <Button onClick={() => setDrawerMode(null)}>Close</Button>
        </div>
      )}
    </div>
  );
};
