import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  EditOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { UserForm } from './UserForm';
import {
  useCreateUserMutation,
  useGetDepartmentsQuery,
  useGetUserQuery,
  useUnlockUserMutation,
  useUpdateUserMutation,
} from '../services/usersApi';
import type { CreateUserRequest, UserFormValues } from '../types';

const { Text } = Typography;

interface UserDrawerProps {
  open: boolean;
  mode: 'view' | 'edit' | 'create';
  userId?: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const UserDrawer = ({
  open,
  mode: initialMode,
  userId,
  onClose,
  onSuccess,
}: UserDrawerProps) => {
  const [mode, setMode] = useState(initialMode);
  const [form] = Form.useForm<UserFormValues>();

  const { data: user, isLoading, isFetching, error } = useGetUserQuery(userId!, {
    skip: !userId || initialMode === 'create',
  });
  const { data: departments } = useGetDepartmentsQuery();

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [unlockUser, { isLoading: isUnlocking }] = useUnlockUserMutation();

  useEffect(() => {
    // Update mode asynchronously to avoid cascading renders
    const timer = setTimeout(() => {
      setMode(initialMode);
      if (initialMode === 'create') {
        form.resetFields();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [initialMode, form]);

  useEffect(() => {
    if (user && mode !== 'create') {
      form.setFieldsValue({
        name: user.name,
        employee_number: user.employee_number,
        department: user.department || undefined,
        email: user.email || undefined,
        is_admin: user.is_admin,
        is_active: user.is_active,
        password: undefined,
      });
    }
  }, [user, mode, form]);

  const isLocked = useMemo(() => {
    if (!user) return false;
    if (typeof user.account_locked === 'boolean') {
      return user.account_locked;
    }
    if (user.account_locked_until) {
      return dayjs(user.account_locked_until).isAfter(dayjs());
    }
    return false;
  }, [user]);

  const handleSubmit = async (values: UserFormValues) => {
    try {
      if (mode === 'create') {
        if (!values.password) {
          message.error('Password is required for new users');
          return;
        }
        const createPayload: CreateUserRequest = {
          name: values.name,
          employee_number: values.employee_number,
          department: values.department,
          email: values.email,
          is_admin: values.is_admin,
          is_active: values.is_active,
          password: values.password,
        };
        await createUser(createPayload).unwrap();
        message.success('User created successfully');
      } else if (userId) {
        const updatePayload: Partial<UserFormValues> = { ...values };
        if (!values.password) {
          delete updatePayload.password;
        }
        await updateUser({ id: userId, data: updatePayload }).unwrap();
        message.success('User updated successfully');
      }
      onSuccess?.();
      onClose();
      form.resetFields();
    } catch (err: unknown) {
      const error = err as { data?: { error?: string; details?: string[] } };
      const errorMessage = error?.data?.error || 'Failed to save user. Please try again.';
      const details = error?.data?.details;
      if (details && details.length > 0) {
        message.error(`${errorMessage}: ${details.join(', ')}`);
      } else {
        message.error(errorMessage);
      }
    }
  };

  const handleUnlock = async () => {
    if (!userId) return;
    try {
      await unlockUser(userId).unwrap();
      message.success('Account unlocked');
      onSuccess?.();
    } catch {
      message.error('Failed to unlock account');
    }
  };

  const getTitle = () => {
    if (mode === 'create') return 'Create User';
    if (mode === 'edit') return 'Edit User';
    return user ? `User: ${user.name}` : 'User Details';
  };

  const renderUserDetails = () => {
    if (isLoading || isFetching) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin />
        </div>
      );
    }

    if (error) {
      return (
        <Alert
          type="error"
          message="Unable to load user details"
          description="Check your permissions or try again later."
          showIcon
        />
      );
    }

    if (!user) {
      return <Empty description="No user selected" />;
    }

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {isLocked && (
          <Alert
            type="warning"
            showIcon
            message="Account locked"
            description={
              <Space direction="vertical">
                <Text>
                  This account is locked due to failed login attempts.
                  {user.account_locked_until && (
                    <>
                      {' '}Unlocks at {dayjs(user.account_locked_until).format('MMM D, YYYY h:mm A')}
                    </>
                  )}
                </Text>
                <Button
                  size="small"
                  icon={<UnlockOutlined />}
                  loading={isUnlocking}
                  onClick={handleUnlock}
                >
                  Unlock Account
                </Button>
              </Space>
            }
          />
        )}

        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Name">
            <Space>
              <Text strong>{user.name}</Text>
              {user.is_admin && <Tag color="gold">Admin</Tag>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Employee Number">
            <Tag color="blue">{user.employee_number}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Department">
            {user.department || 'Not set'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            {user.email || 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Space size="small" wrap>
              <Tag color={user.is_active ? 'green' : 'red'}>
                {user.is_active ? 'Active' : 'Inactive'}
              </Tag>
              {isLocked && <Tag color="red">Locked</Tag>}
              {user.force_password_change && (
                <Tag color="orange">Password change required</Tag>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Roles">
            {user.roles && user.roles.length > 0 ? (
              <Space size={[4, 4]} wrap>
                {user.roles.map((role) => (
                  <Tag key={role.id}>{role.name}</Tag>
                ))}
              </Space>
            ) : (
              'No roles assigned'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Last Password Change">
            {user.password_changed_at
              ? dayjs(user.password_changed_at).format('MMM D, YYYY h:mm A')
              : 'Not recorded'}
          </Descriptions.Item>
          <Descriptions.Item label="Failed Logins">
            {user.failed_login_attempts ?? 0}
            {user.last_failed_login && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                Last attempt: {dayjs(user.last_failed_login).format('MMM D, YYYY h:mm A')}
              </Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {user.created_at
              ? dayjs(user.created_at).format('MMM D, YYYY h:mm A')
              : 'Unknown'}
          </Descriptions.Item>
        </Descriptions>
      </Space>
    );
  };

  const renderActions = () => {
    if (mode !== 'view' || !user) return null;
    return (
      <Space>
        {isLocked && (
          <Button
            icon={<UnlockOutlined />}
            onClick={handleUnlock}
            loading={isUnlocking}
          >
            Unlock
          </Button>
        )}
        <Button
          icon={<EditOutlined />}
          type="primary"
          onClick={() => setMode('edit')}
        >
          Edit
        </Button>
      </Space>
    );
  };

  const renderContent = () => {
    if (mode === 'view') {
      return renderUserDetails();
    }

    return (
      <UserForm
        form={form}
        mode={mode}
        departments={departments}
        onSubmit={handleSubmit}
        onCancel={() => {
          if (mode === 'create') {
            form.resetFields();
            onClose();
            return;
          }
          setMode('view');
          form.resetFields();
        }}
        submitting={isCreating || isUpdating}
      />
    );
  };

  return (
    <Drawer
      width={520}
      title={getTitle()}
      open={open}
      onClose={() => {
        setMode(initialMode);
        form.resetFields();
        onClose();
      }}
      extra={renderActions()}
      destroyOnClose
    >
      {renderContent()}
      {mode === 'edit' && user && (
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message="Updating a user will refresh their roles and status immediately."
          icon={<CheckCircleOutlined style={{ color: '#1677ff' }} />}
        />
      )}
    </Drawer>
  );
};
