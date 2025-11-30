import { useState } from 'react';
import { Button, Space, Modal, Form, Input, message, Select, Switch } from 'antd';
import {
  PlusOutlined,
  LockOutlined,
  SafetyOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { UsersTable } from '@features/users/components/UsersTable';
import { UserDrawer } from '@features/users/components/UserDrawer';
import { UserPermissionEditor } from './UserPermissionEditor';
import {
  useGetRolesQuery,
  useResetUserPasswordMutation,
  useToggleUserStatusMutation,
  useUnlockUserMutation,
  useUpdateUserPermissionsMutation,
} from '../services/adminApi';
import type { User } from '../types';

export const UserManagement = () => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [userPermissionEditorOpen, setUserPermissionEditorOpen] = useState(false);
  const [resetPasswordForm] = Form.useForm();
  const [permissionsForm] = Form.useForm();

  const { data: roles = [] } = useGetRolesQuery();
  const [resetPassword, { isLoading: isResetting }] = useResetUserPasswordMutation();
  const [toggleStatus] = useToggleUserStatusMutation();
  const [unlockUser] = useUnlockUserMutation();
  const [updatePermissions, { isLoading: isUpdatingPermissions }] = useUpdateUserPermissionsMutation();

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

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    resetPasswordForm.resetFields();
    setResetPasswordModalOpen(true);
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await toggleStatus({
        user_id: user.id,
        is_active: !user.is_active,
      }).unwrap();
      message.success(`User ${user.is_active ? 'disabled' : 'enabled'} successfully`);
    } catch {
      message.error('Failed to update user status');
    }
  };

  const handleUnlock = async (user: User) => {
    try {
      await unlockUser(user.id).unwrap();
      message.success('User account unlocked successfully');
    } catch {
      message.error('Failed to unlock user account');
    }
  };

  const handleManagePermissions = (user: User) => {
    setSelectedUser(user);
    permissionsForm.setFieldsValue({
      role_ids: user.roles?.map((r) => r.id) || [],
    });
    setPermissionsModalOpen(true);
  };

  const handleResetPasswordSubmit = async () => {
    try {
      const values = await resetPasswordForm.validateFields();
      await resetPassword({
        user_id: selectedUser!.id,
        new_password: values.new_password,
        force_change: values.force_change,
      }).unwrap();
      message.success('Password reset successfully');
      setResetPasswordModalOpen(false);
      resetPasswordForm.resetFields();
    } catch {
      message.error('Failed to reset password');
    }
  };

  const handlePermissionsSubmit = async () => {
    try {
      const values = await permissionsForm.validateFields();
      await updatePermissions({
        user_id: selectedUser!.id,
        role_ids: values.role_ids,
      }).unwrap();
      message.success('Permissions updated successfully');
      setPermissionsModalOpen(false);
      permissionsForm.resetFields();
    } catch {
      message.error('Failed to update permissions');
    }
  };

  const adminActions = {
    onResetPassword: handleResetPassword,
    onToggleStatus: handleToggleStatus,
    onUnlock: handleUnlock,
    onManagePermissions: handleManagePermissions,
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: 16,
        }}
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
        >
          Add User
        </Button>
      </div>

      <UsersTable
        onView={handleView}
        onEdit={handleEdit}
        adminActions={adminActions}
      />

      <UserDrawer
        open={drawerMode !== null}
        mode={drawerMode || 'view'}
        userId={selectedUser?.id}
        onClose={handleCloseDrawer}
      />

      {/* Reset Password Modal */}
      <Modal
        title={
          <Space>
            <LockOutlined />
            <span>Reset Password</span>
          </Space>
        }
        open={resetPasswordModalOpen}
        onOk={handleResetPasswordSubmit}
        onCancel={() => {
          setResetPasswordModalOpen(false);
          resetPasswordForm.resetFields();
        }}
        confirmLoading={isResetting}
      >
        <Form form={resetPasswordForm} layout="vertical">
          <Form.Item
            name="new_password"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter a new password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          <Form.Item
            name="force_change"
            label="Force password change on next login"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Manage Permissions Modal */}
      <Modal
        title={
          <Space>
            <SafetyOutlined />
            <span>Manage Permissions</span>
          </Space>
        }
        open={permissionsModalOpen}
        onOk={handlePermissionsSubmit}
        onCancel={() => {
          setPermissionsModalOpen(false);
          permissionsForm.resetFields();
        }}
        confirmLoading={isUpdatingPermissions}
        footer={(_, { OkBtn, CancelBtn }) => (
          <>
            <Button
              icon={<KeyOutlined />}
              onClick={() => {
                setPermissionsModalOpen(false);
                setUserPermissionEditorOpen(true);
              }}
            >
              Advanced Permissions
            </Button>
            <CancelBtn />
            <OkBtn />
          </>
        )}
      >
        <Form form={permissionsForm} layout="vertical">
          <Form.Item
            name="role_ids"
            label="Roles"
            rules={[{ required: true, message: 'Please select at least one role' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select roles"
              options={roles.map((role) => ({
                label: role.name,
                value: role.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* User Permission Editor (Advanced) */}
      <UserPermissionEditor
        userId={selectedUser?.id || null}
        userName={selectedUser?.name || ''}
        isAdmin={selectedUser?.is_admin}
        open={userPermissionEditorOpen}
        onClose={() => {
          setUserPermissionEditorOpen(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
};
