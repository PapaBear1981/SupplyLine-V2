import { useMemo, useState } from 'react';
import {
  List,
  SearchBar,
  Tag,
  FloatingBubble,
  Popup,
  Form,
  Input,
  Selector,
  Switch,
  Button,
  Dialog,
  Toast,
  Card,
  Space,
  Empty,
  Skeleton,
} from 'antd-mobile';
import { AddOutline, EditSOutline } from 'antd-mobile-icons';
import dayjs from 'dayjs';
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetUsersQuery,
  useUnlockUserMutation,
  useUpdateUserMutation,
} from '../../services/usersApi';
import type { User, UserFormValues } from '../../types';
import './MobileUsersList.css';

type Mode = 'create' | 'edit' | 'view';

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
] as const;

const lockLabel = (user: User) => {
  if (typeof user.account_locked === 'boolean') return user.account_locked;
  if (user.account_locked_until) return dayjs(user.account_locked_until).isAfter(dayjs());
  return false;
};

export const MobileUsersList = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof statusOptions)[number]['value']>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [popupVisible, setPopupVisible] = useState(false);
  const [form] = Form.useForm<UserFormValues>();

  const { data: users = [], isLoading, refetch } = useGetUsersQuery(search ? { q: search } : undefined);
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deactivateUser, { isLoading: isDeactivating }] = useDeleteUserMutation();
  const [unlockUser, { isLoading: isUnlocking }] = useUnlockUserMutation();

  const filteredUsers = useMemo(() => users.filter((u) => {
    if (status === 'active') return u.is_active;
    if (status === 'inactive') return !u.is_active;
    return true;
  }), [users, status]);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ is_active: true, is_admin: false });
    setSelectedUser(null);
    setMode('create');
    setPopupVisible(true);
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setMode('edit');
    form.setFieldsValue({
      name: user.name,
      employee_number: user.employee_number,
      department: user.department || undefined,
      email: user.email || undefined,
      is_active: user.is_active,
      is_admin: user.is_admin,
      password: undefined,
    });
    setPopupVisible(true);
  };

  const handleView = (user: User) => {
    setSelectedUser(user);
    setMode('view');
    setPopupVisible(true);
  };

  const handleSubmit = async (values: UserFormValues) => {
    try {
      if (mode === 'create') {
        if (!values.password) {
          Toast.show({ content: 'Password required for new user' });
          return;
        }
        await createUser({ ...values, password: values.password }).unwrap();
        Toast.show({ content: 'User created', icon: 'success' });
      } else if (mode === 'edit' && selectedUser) {
        const payload = { ...values };
        if (!payload.password) delete payload.password;
        await updateUser({ id: selectedUser.id, data: payload }).unwrap();
        Toast.show({ content: 'User updated', icon: 'success' });
      }
      setPopupVisible(false);
      form.resetFields();
      refetch();
    } catch {
      Toast.show({ content: 'Unable to save user', icon: 'fail' });
    }
  };

  const handleDeactivate = async (user: User) => {
    const confirmed = await Dialog.confirm({
      content: `Deactivate ${user.name}?`,
      confirmText: 'Deactivate',
    });
    if (!confirmed) return;

    try {
      await deactivateUser(user.id).unwrap();
      Toast.show({ content: 'User deactivated', icon: 'success' });
      refetch();
    } catch {
      Toast.show({ content: 'Failed to deactivate', icon: 'fail' });
    }
  };

  const handleUnlock = async (user: User) => {
    try {
      await unlockUser(user.id).unwrap();
      Toast.show({ content: 'User unlocked', icon: 'success' });
      refetch();
    } catch {
      Toast.show({ content: 'Unlock failed', icon: 'fail' });
    }
  };

  return (
    <div className="mobile-users-list">
      <div className="mobile-users-controls">
        <SearchBar value={search} onChange={setSearch} placeholder="Search users" />
        <Selector
          options={statusOptions.map((s) => ({ label: s.label, value: s.value }))}
          value={[status]}
          onChange={(arr) => setStatus((arr[0] as typeof status) || 'all')}
        />
      </div>

      {isLoading ? (
        <div style={{ padding: 12 }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} animated style={{ marginBottom: 8 }} />)}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Empty description="No users found" style={{ padding: '48px 0' }} />
      ) : (
        <List>
          {filteredUsers.map((user) => {
            const isLocked = lockLabel(user);
            return (
              <List.Item
                key={user.id}
                onClick={() => handleView(user)}
                description={(
                  <Space direction="vertical" block>
                    <div>{user.employee_number} · {user.department || 'No dept'}</div>
                    <div className="mobile-users-tags">
                      <Tag color={user.is_active ? 'success' : 'danger'}>{user.is_active ? 'Active' : 'Inactive'}</Tag>
                      {user.is_admin && <Tag color="warning">Admin</Tag>}
                      {isLocked && <Tag color="danger">Locked</Tag>}
                    </div>
                  </Space>
                )}
                extra={<EditSOutline onClick={(e) => { e.stopPropagation(); openEdit(user); }} />}
              >
                {user.name}
              </List.Item>
            );
          })}
        </List>
      )}

      <FloatingBubble
        style={{ '--initial-position-bottom': '76px', '--initial-position-right': '16px' }}
        onClick={openCreate}
      >
        <AddOutline fontSize={24} />
      </FloatingBubble>

      <Popup
        visible={popupVisible}
        onMaskClick={() => setPopupVisible(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '88vh', overflow: 'auto' }}
      >
        <div className="mobile-users-popup">
          {mode === 'view' && selectedUser ? (
            <Card title={selectedUser.name}>
              <List>
                <List.Item extra={selectedUser.employee_number}>Employee #</List.Item>
                <List.Item extra={selectedUser.department || 'Not set'}>Department</List.Item>
                <List.Item extra={selectedUser.email || 'Not set'}>Email</List.Item>
                <List.Item extra={selectedUser.is_admin ? 'Yes' : 'No'}>Admin</List.Item>
                <List.Item extra={selectedUser.is_active ? 'Active' : 'Inactive'}>Status</List.Item>
              </List>
              <Space block justify="between" style={{ marginTop: 12 }}>
                <Button color="primary" fill="outline" onClick={() => openEdit(selectedUser)}>
                  Edit
                </Button>
                {lockLabel(selectedUser) && (
                  <Button
                    color="warning"
                    fill="outline"
                    loading={isUnlocking}
                    onClick={() => handleUnlock(selectedUser)}
                  >
                    Unlock
                  </Button>
                )}
                {selectedUser.is_active && (
                  <Button
                    color="danger"
                    fill="outline"
                    loading={isDeactivating}
                    onClick={() => handleDeactivate(selectedUser)}
                  >
                    Deactivate
                  </Button>
                )}
              </Space>
            </Card>
          ) : (
            <Form form={form} layout="vertical" onFinish={handleSubmit} footer={
              <Button
                block
                type="submit"
                color="primary"
                loading={isCreating || isUpdating}
              >
                {mode === 'create' ? 'Create User' : 'Save Changes'}
              </Button>
            }>
              <Form.Header>{mode === 'create' ? 'Create User' : 'Edit User'}</Form.Header>
              <Form.Item name="name" label="Full Name" rules={[{ required: true }]}> 
                <Input placeholder="Jane Doe" />
              </Form.Item>
              <Form.Item name="employee_number" label="Employee Number" rules={[{ required: true }]}>
                <Input placeholder="EMP001" />
              </Form.Item>
              <Form.Item name="department" label="Department" rules={[{ required: true }]}> 
                <Input placeholder="Engineering" />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input placeholder="name@company.com" />
              </Form.Item>
              <Form.Item name="password" label={mode === 'create' ? 'Password' : 'Password (optional)'}>
                <Input type="password" placeholder="Set password" />
              </Form.Item>
              <Form.Item name="is_admin" label="Admin Access" trigger="onChange" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="is_active" label="Active" trigger="onChange" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Form>
          )}
          <Button className="mobile-users-close" block onClick={() => setPopupVisible(false)}>
            Close
          </Button>
        </div>
      </Popup>
    </div>
  );
};
