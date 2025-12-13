import { useState, useMemo } from 'react';
import {
  List,
  SearchBar,
  Tag,
  Skeleton,
  PullToRefresh,
  FloatingBubble,
  Popup,
  Form,
  Input,
  Button,
  Picker,
  Switch,
  Toast,
  Dialog,
  SwipeAction,
  Empty,
  Avatar,
} from 'antd-mobile';
import { AddOutline, FilterOutline, CloseOutline } from 'antd-mobile-icons';
import {
  UserOutlined,
  LockOutlined,
  UnlockOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useUnlockUserMutation,
  useGetDepartmentsQuery,
} from '../../services/usersApi';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import type { User, CreateUserRequest, UserFormValues } from '../../types';
import './MobileUsersList.css';

type StatusFilter = 'all' | 'active' | 'inactive';

export const MobileUsersList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [showFormPopup, setShowFormPopup] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [form] = Form.useForm();

  // API queries
  const { data: users = [], isLoading, refetch } = useGetUsersQuery(
    searchQuery ? { q: searchQuery } : undefined
  );
  const { data: departments } = useGetDepartmentsQuery();
  const { data: warehousesData } = useGetWarehousesQuery({ per_page: 1000 });
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [unlockUser, { isLoading: isUnlocking }] = useUnlockUserMutation();

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (statusFilter === 'active' && !user.is_active) return false;
      if (statusFilter === 'inactive' && user.is_active) return false;
      if (adminsOnly && !user.is_admin) return false;
      return true;
    });
  }, [users, statusFilter, adminsOnly]);

  const departmentOptions = useMemo(() => {
    return [[
      { label: 'None', value: '' },
      ...(departments || []).map(d => ({
        label: d.name,
        value: d.name,
      })),
    ]];
  }, [departments]);

  const warehouseOptions = useMemo(() => {
    return [[
      { label: 'None', value: '' },
      ...(warehousesData?.warehouses || []).map(w => ({
        label: w.name,
        value: w.id,
      })),
    ]];
  }, [warehousesData]);

  const isLocked = (user: User) => {
    if (typeof user.account_locked === 'boolean') {
      return user.account_locked;
    }
    if (user.account_locked_until) {
      return dayjs(user.account_locked_until).isAfter(dayjs());
    }
    return false;
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setShowDetailPopup(true);
  };

  const handleCreate = () => {
    setFormMode('create');
    setSelectedUser(null);
    form.resetFields();
    setShowFormPopup(true);
  };

  const handleEdit = (user: User) => {
    setFormMode('edit');
    setSelectedUser(user);
    form.setFieldsValue({
      name: user.name,
      employee_number: user.employee_number,
      department: user.department || '',
      email: user.email || '',
      is_admin: user.is_admin,
      is_active: user.is_active,
      warehouse_id: user.warehouse_id || '',
    });
    setShowDetailPopup(false);
    setShowFormPopup(true);
  };

  const handleDeactivate = async (user: User) => {
    const confirmed = await Dialog.confirm({
      content: `Are you sure you want to deactivate ${user.name}?`,
    });
    if (confirmed) {
      try {
        await deleteUser(user.id).unwrap();
        Toast.show({ content: 'User deactivated', icon: 'success' });
        refetch();
      } catch {
        Toast.show({ content: 'Failed to deactivate user', icon: 'fail' });
      }
    }
  };

  const handleActivate = async (user: User) => {
    try {
      await updateUser({ id: user.id, data: { is_active: true } }).unwrap();
      Toast.show({ content: 'User activated', icon: 'success' });
      refetch();
    } catch {
      Toast.show({ content: 'Failed to activate user', icon: 'fail' });
    }
  };

  const handleUnlock = async (user: User) => {
    try {
      await unlockUser(user.id).unwrap();
      Toast.show({ content: 'Account unlocked', icon: 'success' });
      refetch();
      setShowDetailPopup(false);
    } catch {
      Toast.show({ content: 'Failed to unlock account', icon: 'fail' });
    }
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (formMode === 'create') {
        if (!values.password) {
          Toast.show({ content: 'Password is required', icon: 'fail' });
          return;
        }
        const createPayload: CreateUserRequest = {
          name: values.name,
          employee_number: values.employee_number,
          department: values.department || '',
          email: values.email || undefined,
          is_admin: values.is_admin || false,
          is_active: values.is_active !== false,
          warehouse_id: values.warehouse_id || undefined,
          password: values.password,
        };
        await createUser(createPayload).unwrap();
        Toast.show({ content: 'User created', icon: 'success' });
      } else if (selectedUser) {
        const updatePayload: Partial<UserFormValues> = {
          name: values.name,
          employee_number: values.employee_number,
          department: values.department || '',
          email: values.email || undefined,
          is_admin: values.is_admin,
          is_active: values.is_active,
          warehouse_id: values.warehouse_id || undefined,
        };
        if (values.password) {
          updatePayload.password = values.password;
        }
        await updateUser({ id: selectedUser.id, data: updatePayload }).unwrap();
        Toast.show({ content: 'User updated', icon: 'success' });
      }
      setShowFormPopup(false);
      refetch();
    } catch {
      Toast.show({ content: 'Failed to save user', icon: 'fail' });
    }
  };

  const renderUserItem = (user: User) => (
    <SwipeAction
      key={user.id}
      rightActions={[
        {
          key: 'edit',
          text: 'Edit',
          color: 'primary',
          onClick: () => handleEdit(user),
        },
        user.is_active ? {
          key: 'deactivate',
          text: 'Deactivate',
          color: 'danger',
          onClick: () => handleDeactivate(user),
        } : {
          key: 'activate',
          text: 'Activate',
          color: 'success',
          onClick: () => handleActivate(user),
        },
      ]}
    >
      <List.Item
        onClick={() => handleUserClick(user)}
        prefix={
          <Avatar
            src={user.avatar || ''}
            style={{ '--size': '44px', '--border-radius': '50%' }}
            fallback={<UserOutlined style={{ fontSize: 20 }} />}
          />
        }
        description={
          <div className="user-item-desc">
            <span>{user.department || 'No department'}</span>
            <div className="user-item-tags">
              <Tag color={user.is_active ? '#52c41a' : '#ff4d4f'} fill="outline" style={{ '--border-radius': '4px' }}>
                {user.is_active ? 'Active' : 'Inactive'}
              </Tag>
              {user.is_admin && (
                <Tag color="#faad14" fill="outline" style={{ '--border-radius': '4px' }}>
                  Admin
                </Tag>
              )}
              {isLocked(user) && (
                <Tag color="#ff4d4f" fill="outline" style={{ '--border-radius': '4px' }}>
                  <LockOutlined /> Locked
                </Tag>
              )}
            </div>
          </div>
        }
        arrow
      >
        <div className="user-item-title">{user.name}</div>
        <div className="user-item-subtitle">#{user.employee_number}</div>
      </List.Item>
    </SwipeAction>
  );

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (adminsOnly ? 1 : 0);

  return (
    <div className="mobile-users-list">
      {/* Search Bar */}
      <div className="search-bar-container">
        <SearchBar
          placeholder="Search users..."
          value={searchQuery}
          onChange={handleSearch}
          className="search-bar"
        />
        <div
          className={`filter-button ${activeFilterCount > 0 ? 'active' : ''}`}
          onClick={() => setShowFilterPopup(true)}
        >
          <FilterOutline />
          {activeFilterCount > 0 && (
            <span className="filter-badge">{activeFilterCount}</span>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {(statusFilter !== 'all' || adminsOnly) && (
        <div className="active-filters">
          {statusFilter !== 'all' && (
            <Tag
              color="primary"
              fill="outline"
              style={{ '--border-radius': '12px' }}
            >
              {statusFilter === 'active' ? 'Active' : 'Inactive'}
              <CloseOutline
                onClick={() => setStatusFilter('all')}
                style={{ marginLeft: 4 }}
              />
            </Tag>
          )}
          {adminsOnly && (
            <Tag
              color="primary"
              fill="outline"
              style={{ '--border-radius': '12px' }}
            >
              Admins only
              <CloseOutline
                onClick={() => setAdminsOnly(false)}
                style={{ marginLeft: 4 }}
              />
            </Tag>
          )}
        </div>
      )}

      {/* User List */}
      <PullToRefresh onRefresh={handleRefresh}>
        {isLoading ? (
          <div style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} animated className="user-skeleton" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <Empty description="No users found" style={{ padding: '48px 0' }} />
        ) : (
          <List>
            {filteredUsers.map(renderUserItem)}
          </List>
        )}
      </PullToRefresh>

      {/* Floating Add Button */}
      <FloatingBubble
        style={{
          '--initial-position-bottom': '76px',
          '--initial-position-right': '16px',
          '--edge-distance': '16px',
        }}
        onClick={handleCreate}
      >
        <AddOutline fontSize={24} />
      </FloatingBubble>

      {/* Filter Popup */}
      <Popup
        visible={showFilterPopup}
        onMaskClick={() => setShowFilterPopup(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
      >
        <div className="filter-popup">
          <div className="filter-header">
            <span>Filter Users</span>
            <Button
              size="small"
              onClick={() => {
                setStatusFilter('all');
                setAdminsOnly(false);
                setShowFilterPopup(false);
              }}
            >
              Clear All
            </Button>
          </div>
          <List>
            <List.Item extra={statusFilter === 'all' ? 'All' : statusFilter}>
              Status
            </List.Item>
          </List>
          <div className="filter-options">
            {[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ].map(option => (
              <Tag
                key={option.value}
                color={statusFilter === option.value ? 'primary' : 'default'}
                onClick={() => {
                  setStatusFilter(option.value as StatusFilter);
                }}
                style={{ margin: 4, padding: '6px 12px' }}
              >
                {option.label}
              </Tag>
            ))}
          </div>
          <List>
            <List.Item
              extra={
                <Switch
                  checked={adminsOnly}
                  onChange={setAdminsOnly}
                />
              }
            >
              Admins only
            </List.Item>
          </List>
          <div style={{ padding: '12px 16px' }}>
            <Button
              block
              color="primary"
              onClick={() => setShowFilterPopup(false)}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </Popup>

      {/* User Detail Popup */}
      <Popup
        visible={showDetailPopup}
        onMaskClick={() => setShowDetailPopup(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        {selectedUser && (
          <div className="detail-popup">
            <div className="detail-header">
              <div className="detail-user-info">
                <Avatar
                  src={selectedUser.avatar || ''}
                  style={{ '--size': '56px', '--border-radius': '50%' }}
                  fallback={<UserOutlined style={{ fontSize: 24 }} />}
                />
                <div>
                  <div className="detail-title">{selectedUser.name}</div>
                  <div className="detail-subtitle">#{selectedUser.employee_number}</div>
                </div>
              </div>
              <div className="detail-badges">
                <Tag color={selectedUser.is_active ? '#52c41a' : '#ff4d4f'}>
                  {selectedUser.is_active ? 'Active' : 'Inactive'}
                </Tag>
                {selectedUser.is_admin && (
                  <Tag color="#faad14">Admin</Tag>
                )}
              </div>
            </div>

            {isLocked(selectedUser) && (
              <div className="locked-warning">
                <LockOutlined style={{ marginRight: 8 }} />
                Account is locked
                {selectedUser.account_locked_until && (
                  <span> until {dayjs(selectedUser.account_locked_until).format('MMM D, h:mm A')}</span>
                )}
              </div>
            )}

            <List>
              <List.Item extra={selectedUser.department || 'Not set'}>Department</List.Item>
              <List.Item extra={selectedUser.email || 'Not provided'}>Email</List.Item>
              <List.Item extra={selectedUser.warehouse_name || 'Not assigned'}>Warehouse</List.Item>
              <List.Item extra={
                selectedUser.roles && selectedUser.roles.length > 0
                  ? selectedUser.roles.map(r => r.name).join(', ')
                  : 'No roles'
              }>
                Roles
              </List.Item>
              <List.Item extra={selectedUser.failed_login_attempts ?? 0}>
                Failed Login Attempts
              </List.Item>
              <List.Item extra={
                selectedUser.created_at
                  ? dayjs(selectedUser.created_at).format('MMM D, YYYY')
                  : 'Unknown'
              }>
                Created
              </List.Item>
            </List>

            <div className="detail-actions">
              <Button block color="primary" onClick={() => handleEdit(selectedUser)}>
                Edit User
              </Button>
              {isLocked(selectedUser) && (
                <Button
                  block
                  color="primary"
                  fill="outline"
                  loading={isUnlocking}
                  onClick={() => handleUnlock(selectedUser)}
                >
                  <UnlockOutlined /> Unlock Account
                </Button>
              )}
              {selectedUser.is_active ? (
                <Button
                  block
                  color="danger"
                  fill="outline"
                  onClick={() => {
                    setShowDetailPopup(false);
                    handleDeactivate(selectedUser);
                  }}
                >
                  <StopOutlined /> Deactivate User
                </Button>
              ) : (
                <Button
                  block
                  color="success"
                  fill="outline"
                  onClick={() => {
                    setShowDetailPopup(false);
                    handleActivate(selectedUser);
                  }}
                >
                  <CheckCircleOutlined /> Activate User
                </Button>
              )}
            </div>
          </div>
        )}
      </Popup>

      {/* User Form Popup */}
      <Popup
        visible={showFormPopup}
        onMaskClick={() => setShowFormPopup(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          height: '90vh',
          overflow: 'auto',
        }}
      >
        <div className="form-popup">
          <div className="form-header">
            <span>{formMode === 'create' ? 'Add New User' : 'Edit User'}</span>
            <CloseOutline onClick={() => setShowFormPopup(false)} />
          </div>
          <Form
            form={form}
            layout="vertical"
            footer={
              <Button
                block
                color="primary"
                loading={isCreating || isUpdating}
                onClick={handleFormSubmit}
              >
                {formMode === 'create' ? 'Create User' : 'Save Changes'}
              </Button>
            }
          >
            <Form.Item
              name="name"
              label="Full Name"
              rules={[{ required: true, message: 'Name is required' }]}
            >
              <Input placeholder="Enter full name" />
            </Form.Item>
            <Form.Item
              name="employee_number"
              label="Employee Number"
              rules={[{ required: true, message: 'Employee number is required' }]}
            >
              <Input placeholder="Enter employee number" />
            </Form.Item>
            <Form.Item
              name="department"
              label="Department"
              trigger="onConfirm"
              onClick={(_e, pickerRef) => pickerRef.current?.open()}
            >
              <Picker columns={departmentOptions}>
                {(items) => items[0]?.label || 'Select department'}
              </Picker>
            </Form.Item>
            <Form.Item
              name="email"
              label="Email"
            >
              <Input placeholder="Enter email (optional)" type="email" />
            </Form.Item>
            <Form.Item
              name="warehouse_id"
              label="Assigned Warehouse"
              trigger="onConfirm"
              onClick={(_e, pickerRef) => pickerRef.current?.open()}
            >
              <Picker columns={warehouseOptions}>
                {(items) => items[0]?.label || 'Select warehouse'}
              </Picker>
            </Form.Item>
            <Form.Item
              name="password"
              label={formMode === 'create' ? 'Password' : 'New Password (leave blank to keep current)'}
              rules={formMode === 'create' ? [{ required: true, message: 'Password is required' }] : []}
            >
              <Input placeholder="Enter password" type="password" />
            </Form.Item>
            <Form.Item
              name="is_admin"
              label="Administrator"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="is_active"
              label="Active"
              valuePropName="checked"
              initialValue={true}
            >
              <Switch />
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
