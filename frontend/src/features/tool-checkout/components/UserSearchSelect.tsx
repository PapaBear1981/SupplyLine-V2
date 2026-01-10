import { useState, useEffect } from 'react';
import { Input, List, Tag, Space, Typography, Spin, Button, Card, theme } from 'antd';
import {
  SearchOutlined,
  UserOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useLazyGetUsersQuery } from '@features/users/services/usersApi';
import type { User } from '@features/users/types';

const { Text } = Typography;
const { useToken } = theme;

interface UserSearchSelectProps {
  onChange: (userId: number | null, user: User | null) => void;
  disabled?: boolean;
}

export const UserSearchSelect = ({
  onChange,
  disabled = false,
}: UserSearchSelectProps) => {
  const { token } = useToken();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [searchUsers, { isLoading: searching }] = useLazyGetUsersQuery();

  // Debounced search
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const result = await searchUsers({ q: searchTerm }).unwrap();
          // Filter for active users only
          const activeUsers = result.filter((user) => user.is_active);
          setSearchResults(activeUsers);
        } catch (error) {
          console.error('Error searching users:', error);
          setSearchResults([]);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setSearchResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, searchUsers]);

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSearchTerm('');
    setSearchResults([]);
    onChange(user.id, user);
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    onChange(null, null);
  };

  // Show selected user
  if (selectedUser) {
    return (
      <Card
        size="small"
        style={{
          backgroundColor: token.colorSuccessBg,
          borderColor: token.colorSuccess,
          marginBottom: 16,
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Space>
            <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 18 }} />
            <Text strong style={{ fontSize: 16 }}>
              {selectedUser.name}
            </Text>
            <Text type="secondary">#{selectedUser.employee_number}</Text>
          </Space>
          {selectedUser.department && (
            <Tag color="blue">{selectedUser.department}</Tag>
          )}
          {!disabled && (
            <Button
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={handleClearUser}
            >
              Change User
            </Button>
          )}
        </Space>
      </Card>
    );
  }

  // Show search interface
  return (
    <div>
      <Input
        placeholder="Search by name or employee number..."
        prefix={<SearchOutlined />}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        disabled={disabled}
        size="large"
        style={{ marginBottom: 8 }}
        allowClear
      />
      {searching && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
        </div>
      )}
      {!searching && searchResults.length > 0 && (
        <List
          size="small"
          dataSource={searchResults}
          style={{
            maxHeight: 300,
            overflowY: 'auto',
            border: `1px solid ${token.colorBorder}`,
            borderRadius: token.borderRadius,
          }}
          renderItem={(user) => (
            <List.Item
              key={user.id}
              onClick={() => handleSelectUser(user)}
              style={{
                cursor: 'pointer',
                padding: '12px 16px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = token.colorBgTextHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <List.Item.Meta
                avatar={<UserOutlined style={{ fontSize: 24 }} />}
                title={
                  <Space>
                    <Text strong>{user.name}</Text>
                    <Text type="secondary">#{user.employee_number}</Text>
                  </Space>
                }
                description={
                  <Space size="small">
                    {user.department && <Tag color="blue">{user.department}</Tag>}
                    {user.email && <Text type="secondary">{user.email}</Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
      {!searching && searchTerm.length >= 2 && searchResults.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
          <Text type="secondary">No users found</Text>
        </div>
      )}
      {!searching && searchTerm.length > 0 && searchTerm.length < 2 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
          <Text type="secondary">Type at least 2 characters to search</Text>
        </div>
      )}
    </div>
  );
};
