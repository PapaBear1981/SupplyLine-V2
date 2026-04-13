import { useMemo, useState } from 'react';
import {
  List,
  Tag,
  Button,
  SearchBar,
  Toast,
  Form,
  Input,
  Selector,
  SpinLoading,
  Avatar,
} from 'antd-mobile';
import { LeftOutline } from 'antd-mobile-icons';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import {
  useGetUsersQuery,
  useUpdateUserMutation,
  useUnlockUserMutation,
} from '@features/users/services/usersApi';
import { useResetUserPasswordMutation } from '../../services/adminApi';
import type { User } from '@features/users/types';
import {
  MobilePageScaffold,
  MobileDetailHeader,
  MobileSectionCard,
  MobileEmptyState,
  MobileFormSheet,
  MobileConfirmSheet,
} from '@shared/components/mobile';
import { useHaptics } from '@shared/hooks/useHaptics';

interface MobileUsersListProps {
  onBack?: () => void;
}

interface EditUserValues {
  name: string;
  department?: string;
  email?: string;
  is_admin?: ('true' | 'false')[];
  is_active?: ('true' | 'false')[];
}

/**
 * Mobile-friendly user management. Exposes the subset of user
 * actions that make sense on a phone: list + search, view, edit
 * profile fields, unlock locked accounts, reset password.
 *
 * Role/permission assignment stays desktop-only (the matrix UI
 * doesn't translate to a small screen), and creation of new
 * users stays desktop-only (they need employee_number + password
 * provisioning that's inherently form-heavy).
 */
export const MobileUsersList = ({ onBack }: MobileUsersListProps) => {
  const haptics = useHaptics();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [form] = Form.useForm<EditUserValues>();

  const { data: users, isLoading, refetch } = useGetUsersQuery({
    q: search || undefined,
  });

  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [unlockUser, { isLoading: unlocking }] = useUnlockUserMutation();
  const [resetPassword, { isLoading: resetting }] = useResetUserPasswordMutation();

  const filtered = useMemo(() => users ?? [], [users]);

  const openEdit = (user: User) => {
    setSelectedUser(user);
    form.setFieldsValue({
      name: user.name,
      department: user.department ?? undefined,
      email: user.email ?? undefined,
      is_admin: [user.is_admin ? 'true' : 'false'],
      is_active: [user.is_active ? 'true' : 'false'],
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      const values = await form.validateFields();
      await updateUser({
        id: selectedUser.id,
        data: {
          name: values.name,
          department: values.department ?? '',
          email: values.email ?? '',
          is_admin: values.is_admin?.[0] === 'true',
          is_active: values.is_active?.[0] === 'true',
        },
      }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'User updated' });
      setEditOpen(false);
      setSelectedUser(null);
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to update user' });
    }
  };

  const handleUnlock = async (user: User) => {
    try {
      await unlockUser(user.id).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'User unlocked' });
    } catch {
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to unlock user' });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    try {
      // Generate a cryptographically random temporary password the user
      // will have to change on next login. Server also tracks
      // force_password_change on the User model.
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const tempPassword = Array.from(randomBytes, (b) =>
        b.toString(16).padStart(2, '0')
      )
        .join('')
        .slice(0, 16);

      await resetPassword({
        user_id: selectedUser.id,
        new_password: tempPassword,
        force_change: true,
      }).unwrap();

      try {
        await navigator.clipboard.writeText(tempPassword);
        Toast.show({
          icon: 'success',
          content: 'Temporary password copied to clipboard',
          duration: 3000,
        });
      } catch {
        Toast.show({
          icon: 'success',
          content: `Temp password: ${tempPassword}`,
          duration: 5000,
        });
      }
      haptics.trigger('success');
      setResetConfirmOpen(false);
    } catch {
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to reset password' });
    }
  };

  return (
    <MobilePageScaffold
      header={
        <MobileDetailHeader
          title="User Management"
          subtitle={`${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
          actions={
            onBack && (
              <Button size="small" fill="none" onClick={onBack}>
                <LeftOutline /> Back
              </Button>
            )
          }
        />
      }
      sticky={
        <SearchBar
          placeholder="Search users…"
          value={search}
          onChange={setSearch}
        />
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <SpinLoading />
        </div>
      ) : filtered.length === 0 ? (
        <MobileEmptyState
          title="No users found"
          description="Try a different search term."
          actionLabel="Refresh"
          onAction={() => {
            void refetch();
          }}
        />
      ) : (
        <MobileSectionCard flush>
          <List>
            {filtered.map((user) => (
              <List.Item
                key={user.id}
                prefix={
                  <Avatar
                    src={user.avatar ?? ''}
                    style={{ '--size': '40px', '--border-radius': '50%' }}
                  />
                }
                description={
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    <Tag fill="outline">#{user.employee_number}</Tag>
                    {user.department && <Tag fill="outline">{user.department}</Tag>}
                    {user.is_admin && (
                      <Tag color="primary" fill="outline">
                        Admin
                      </Tag>
                    )}
                    {!user.is_active && (
                      <Tag color="default" fill="outline">
                        Inactive
                      </Tag>
                    )}
                    {user.account_locked && (
                      <Tag color="danger" fill="outline">
                        <LockOutlined /> Locked
                      </Tag>
                    )}
                  </div>
                }
                onClick={() => openEdit(user)}
              >
                <div style={{ fontWeight: 600 }}>{user.name}</div>
              </List.Item>
            ))}
          </List>
        </MobileSectionCard>
      )}

      {/* Edit user sheet */}
      <MobileFormSheet
        visible={editOpen}
        title={selectedUser ? selectedUser.name : 'Edit User'}
        subtitle={selectedUser ? `#${selectedUser.employee_number}` : undefined}
        onClose={() => {
          setEditOpen(false);
          setSelectedUser(null);
        }}
        onSubmit={handleSave}
        submitting={updating}
        submitLabel="Save"
        fullScreen
      >
        {selectedUser && (
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Name is required' }]}
            >
              <Input placeholder="Full name" />
            </Form.Item>
            <Form.Item name="department" label="Department">
              <Input placeholder="Department" />
            </Form.Item>
            <Form.Item name="email" label="Email">
              <Input placeholder="email@example.com" />
            </Form.Item>
            <Form.Item name="is_admin" label="Role">
              <Selector
                multiple={false}
                options={[
                  { label: 'User', value: 'false' },
                  { label: 'Admin', value: 'true' },
                ]}
              />
            </Form.Item>
            <Form.Item name="is_active" label="Status">
              <Selector
                multiple={false}
                options={[
                  { label: 'Active', value: 'true' },
                  { label: 'Inactive', value: 'false' },
                ]}
              />
            </Form.Item>

            {/* Secondary actions */}
            <div
              style={{
                marginTop: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {selectedUser.account_locked && (
                <Button
                  block
                  color="warning"
                  loading={unlocking}
                  onClick={() => {
                    if (selectedUser) handleUnlock(selectedUser);
                  }}
                >
                  <UnlockOutlined /> Unlock account
                </Button>
              )}
              <Button
                block
                fill="outline"
                onClick={() => setResetConfirmOpen(true)}
              >
                <LockOutlined /> Reset password
              </Button>
            </div>
          </Form>
        )}
      </MobileFormSheet>

      <MobileConfirmSheet
        visible={resetConfirmOpen}
        title="Reset password?"
        description={
          selectedUser
            ? `A password reset email will be sent to ${selectedUser.name}.`
            : ''
        }
        confirmLabel="Reset password"
        onConfirm={handleResetPassword}
        onClose={() => setResetConfirmOpen(false)}
        loading={resetting}
      />
    </MobilePageScaffold>
  );
};
