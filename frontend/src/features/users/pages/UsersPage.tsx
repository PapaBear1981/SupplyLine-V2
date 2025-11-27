import { useState } from 'react';
import { Button, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { UsersTable } from '../components/UsersTable';
import { UserDrawer } from '../components/UserDrawer';
import type { User } from '../types';

const { Title, Paragraph } = Typography;

export const UsersPage = () => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);

  const handleView = (user: User) => {
    setSelectedUser(user);
    setDrawerMode('view');
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setDrawerMode('edit');
  };

  const handleCreate = () => {
    setSelectedUser(null);
    setDrawerMode('create');
  };

  const handleCloseDrawer = () => {
    setDrawerMode(null);
    setSelectedUser(null);
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
          gap: 12,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>Users</Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
            Manage user access, departments, and lockouts
          </Paragraph>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Add User
          </Button>
        </Space>
      </div>

      <UsersTable onView={handleView} onEdit={handleEdit} />

      <UserDrawer
        open={drawerMode !== null}
        mode={drawerMode || 'view'}
        userId={selectedUser?.id}
        onClose={handleCloseDrawer}
      />
    </div>
  );
};
