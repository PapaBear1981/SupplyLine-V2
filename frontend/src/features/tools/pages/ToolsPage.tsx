import { useMemo, useState } from 'react';
import { Typography, Button, Space, List, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ToolsTable } from '../components/ToolsTable';
import { ToolDrawer } from '../components/ToolDrawer';
import type { Tool } from '../types';
import { useGetToolsQuery } from '../services/toolsApi';
import { useIsMobile } from '@shared/hooks/useIsMobile';
import { MobilePage } from '@shared/components/mobile/MobilePage';

const { Title } = Typography;

export const ToolsPage = () => {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const isMobile = useIsMobile();
  const { data } = useGetToolsQuery({ page: 1, per_page: 25 });

  const mobileTools = useMemo(
    () => data?.tools?.slice(0, 25) ?? [],
    [data?.tools],
  );

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

  const desktopContent = (
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
    </div>
  );

  if (isMobile) {
    return (
      <MobilePage
        title="Tools"
        subtitle="Search, inspect, and update tools from your device"
        actions={[
          {
            key: 'add',
            node: (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Add Tool
              </Button>
            ),
          },
        ]}
      >
        <List
          dataSource={mobileTools}
          renderItem={(tool) => (
            <List.Item
              key={tool.id}
              actions={[
                <Button type="link" onClick={() => handleView(tool)} key="view">
                  View
                </Button>,
                <Button type="link" onClick={() => handleEdit(tool)} key="edit">
                  Edit
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space direction="vertical" size={4}>
                    <Space size={6}>
                      <Title level={5} style={{ margin: 0 }}>
                        {tool.tool_number}
                      </Title>
                      <Tag color="blue">{tool.category}</Tag>
                    </Space>
                    <span>{tool.description}</span>
                  </Space>
                }
                description={
                  <Space size={8}>
                    <Tag color={tool.status === 'available' ? 'green' : 'orange'}>
                      {tool.status.replace('_', ' ')}
                    </Tag>
                    <Tag>{tool.location}</Tag>
                  </Space>
                }
              />
            </List.Item>
          )}
        />

        <ToolDrawer
          open={drawerMode !== null}
          mode={drawerMode || 'view'}
          toolId={selectedTool?.id}
          onClose={handleCloseDrawer}
        />
      </MobilePage>
    );
  }

  return (
    <>
      {desktopContent}
      <ToolDrawer
        open={drawerMode !== null}
        mode={drawerMode || 'view'}
        toolId={selectedTool?.id}
        onClose={handleCloseDrawer}
      />
    </>
  );
};
