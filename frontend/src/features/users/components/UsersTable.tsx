import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import {
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  SearchOutlined,
  StopOutlined,
  UnlockOutlined,
  LockOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useDeleteUserMutation,
  useGetDepartmentsQuery,
  useGetUsersQuery,
  useUnlockUserMutation,
  useUpdateUserMutation,
} from '../services/usersApi';
import type { User } from '../types';

const { Text } = Typography;

interface AdminActions {
  onResetPassword?: (user: User) => void;
  onToggleStatus?: (user: User) => void;
  onUnlock?: (user: User) => void;
  onManagePermissions?: (user: User) => void;
}

interface UsersTableProps {
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  adminActions?: AdminActions;
}

type StatusFilter = 'all' | 'active' | 'inactive';

export const UsersTable = ({ onView, onEdit, adminActions }: UsersTableProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [adminsOnly, setAdminsOnly] = useState(false);

  const { data: users = [], isLoading, isFetching, error } = useGetUsersQuery(
    searchQuery ? { q: searchQuery } : undefined
  );
  const { data: departments } = useGetDepartmentsQuery();

  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [unlockUser, { isLoading: isUnlocking }] = useUnlockUserMutation();

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (statusFilter === 'active' && !user.is_active) return false;
      if (statusFilter === 'inactive' && user.is_active) return false;
      if (departmentFilter && user.department !== departmentFilter) return false;
      if (adminsOnly && !user.is_admin) return false;
      return true;
    });
  }, [users, statusFilter, departmentFilter, adminsOnly]);

  const handleDeactivate = async (id: number) => {
    try {
      await deleteUser(id).unwrap();
      message.success('User deactivated');
    } catch {
      message.error('Failed to deactivate user');
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await updateUser({ id, data: { is_active: true } }).unwrap();
      message.success('User activated');
    } catch {
      message.error('Failed to activate user');
    }
  };

  const handleUnlock = async (id: number) => {
    try {
      await unlockUser(id).unwrap();
      message.success('Account unlocked');
    } catch {
      message.error('Failed to unlock account');
    }
  };

  const isLocked = (user: User) => {
    if (typeof user.account_locked === 'boolean') {
      return user.account_locked;
    }
    if (user.account_locked_until) {
      return dayjs(user.account_locked_until).isAfter(dayjs());
    }
    return false;
  };

  const columns: TableProps<User>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      render: (_, record) => (
        <Space size="small">
          <Text strong>{record.name}</Text>
          {record.is_admin && <Tag color="gold">Admin</Tag>}
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Employee #',
      dataIndex: 'employee_number',
      key: 'employee_number',
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (value: string | null) => value || '—',
      filters: (departments || []).map((dept) => ({
        text: dept.name,
        value: dept.name,
      })),
      onFilter: (value, record) => record.department === value,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (value: string | null) => value || '—',
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      render: (_value, record) =>
        record.roles && record.roles.length > 0 ? (
          <Space size={[4, 4]} wrap>
            {record.roles.map((role) => (
              <Tag key={role.id}>{role.name}</Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">No roles</Text>
        ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Space size="small" wrap>
          <Tag color={record.is_active ? 'green' : 'red'}>
            {record.is_active ? 'Active' : 'Inactive'}
          </Tag>
          {isLocked(record) && <Tag color="red">Locked</Tag>}
        </Space>
      ),
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Inactive', value: 'inactive' },
      ],
      onFilter: (value, record) =>
        value === 'active' ? record.is_active : !record.is_active,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string | null | undefined) =>
        value ? dayjs(value).format('MMM D, YYYY') : '—',
      sorter: (a, b) => {
        const aTime = a.created_at ? dayjs(a.created_at).valueOf() : 0;
        const bTime = b.created_at ? dayjs(b.created_at).valueOf() : 0;
        return aTime - bTime;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: adminActions ? 280 : 220,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View details">
            <Button type="text" icon={<EyeOutlined />} onClick={() => onView(record)} />
          </Tooltip>
          <Tooltip title="Edit user">
            <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(record)} />
          </Tooltip>
          {adminActions ? (
            <>
              {adminActions.onToggleStatus && (
                <Tooltip title={record.is_active ? 'Disable user' : 'Enable user'}>
                  <Button
                    type="text"
                    danger={record.is_active}
                    icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                    onClick={() => adminActions.onToggleStatus!(record)}
                  />
                </Tooltip>
              )}
              {adminActions.onUnlock && isLocked(record) && (
                <Tooltip title="Unlock account">
                  <Button
                    type="text"
                    icon={<UnlockOutlined />}
                    onClick={() => adminActions.onUnlock!(record)}
                  />
                </Tooltip>
              )}
              {adminActions.onResetPassword && (
                <Tooltip title="Reset password">
                  <Button
                    type="text"
                    icon={<LockOutlined />}
                    onClick={() => adminActions.onResetPassword!(record)}
                  />
                </Tooltip>
              )}
              {adminActions.onManagePermissions && (
                <Tooltip title="Manage permissions">
                  <Button
                    type="text"
                    icon={<SafetyOutlined />}
                    onClick={() => adminActions.onManagePermissions!(record)}
                  />
                </Tooltip>
              )}
            </>
          ) : (
            <>
              {record.is_active ? (
                <Popconfirm
                  title="Deactivate user?"
                  description="User will lose access until reactivated."
                  onConfirm={() => handleDeactivate(record.id)}
                  okButtonProps={{ danger: true }}
                >
                  <Tooltip title="Deactivate">
                    <Button type="text" danger icon={<StopOutlined />} />
                  </Tooltip>
                </Popconfirm>
              ) : (
                <Tooltip title="Activate">
                  <Button
                    type="text"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleActivate(record.id)}
                  />
                </Tooltip>
              )}
              {isLocked(record) && (
                <Tooltip title="Unlock account">
                  <Button
                    type="text"
                    icon={<UnlockOutlined />}
                    loading={isUnlocking}
                    onClick={() => handleUnlock(record.id)}
                  />
                </Tooltip>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space
        style={{ marginBottom: 16, width: '100%' }}
        size={[12, 12]}
        wrap
        align="center"
      >
        <Input
          placeholder="Search by name or employee number"
          prefix={<SearchOutlined />}
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <Select
        placeholder="Status"
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as StatusFilter)}
        style={{ width: 140 }}
        options={[
          { label: 'All', value: 'all' },
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
          ]}
        />
        <Select
          allowClear
          placeholder="Department"
          value={departmentFilter}
          onChange={(value) => setDepartmentFilter(value || null)}
          style={{ width: 180 }}
          options={(departments || []).map((dept) => ({
            label: dept.name,
            value: dept.name,
          }))}
          showSearch
          optionFilterProp="label"
        />
        <Space size="small">
          <Switch checked={adminsOnly} onChange={(checked) => setAdminsOnly(checked)} />
          <Text type="secondary">Admins only</Text>
        </Space>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Unable to load users"
          description="Check your permissions or try again later."
          style={{ marginBottom: 12 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={filteredUsers}
        rowKey="id"
        loading={isLoading || isFetching || isDeleting || isUpdating || isUnlocking}
        scroll={{ x: 1000 }}
        pagination={{
          pageSize: 25,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50', '100'],
          showTotal: (total) => `${total} users`,
        }}
      />
    </div>
  );
};
