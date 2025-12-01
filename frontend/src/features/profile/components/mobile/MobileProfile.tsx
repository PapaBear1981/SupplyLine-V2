import { useState } from 'react';
import {
  List,
  Card,
  Avatar,
  Button,
  Popup,
  Form,
  Input,
  Toast,
  Tag,
  Space,
  ImageUploader,
} from 'antd-mobile';
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader';
import {
  UserOutline,
  EditSOutline,
  LockOutline,
  MailOutline,
  TeamOutline,
  FileOutline,
} from 'antd-mobile-icons';
import { useAppSelector, useAppDispatch } from '@app/hooks';
import { setCredentials } from '@features/auth/slices/authSlice';
import {
  useUploadAvatarMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} from '../../services/profileApi';
import './MobileProfile.css';

export const MobileProfile = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.token);

  const [uploadAvatar] = useUploadAvatarMutation();
  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();

  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const handleAvatarUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await uploadAvatar(formData).unwrap();

      if (user && token) {
        dispatch(
          setCredentials({
            user: { ...user, avatar: response.avatar_url },
            token,
          })
        );
      }

      Toast.show({
        icon: 'success',
        content: 'Avatar updated successfully!',
      });
      return {
        url: response.avatar_url,
      };
    } catch {
      Toast.show({
        icon: 'fail',
        content: 'Failed to upload avatar',
      });
      throw new Error('Upload failed');
    }
  };

  const beforeUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      Toast.show({
        icon: 'fail',
        content: 'Please upload an image file',
      });
      return null;
    }
    if (file.size > 2 * 1024 * 1024) {
      Toast.show({
        icon: 'fail',
        content: 'Image must be smaller than 2MB',
      });
      return null;
    }
    return file;
  };

  const handleEditProfile = async () => {
    try {
      const values = await editForm.validateFields();
      const updatedUser = await updateProfile(values).unwrap();

      if (token) {
        dispatch(setCredentials({ user: updatedUser, token }));
      }

      Toast.show({
        icon: 'success',
        content: 'Profile updated successfully!',
      });
      setEditProfileVisible(false);
      editForm.resetFields();
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      Toast.show({
        icon: 'fail',
        content: err?.data?.message || 'Failed to update profile',
      });
    }
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      await changePassword(values).unwrap();

      Toast.show({
        icon: 'success',
        content: 'Password changed successfully!',
      });
      setChangePasswordVisible(false);
      passwordForm.resetFields();
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      Toast.show({
        icon: 'fail',
        content: err?.data?.message || 'Failed to change password',
      });
    }
  };

  if (!user) {
    return (
      <div className="mobile-profile-loading">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="mobile-profile">
      {/* Profile Header */}
      <Card className="profile-header-card">
        <div className="profile-header">
          <div className="avatar-section">
            <Avatar
              src={user.avatar || ''}
              style={{ '--size': '80px' }}
              fallback={<UserOutline style={{ fontSize: 40 }} />}
            />
            <ImageUploader
              value={[]}
              onChange={async (items: ImageUploadItem[]) => {
                if (items.length > 0) {
                  const item = items[0] as ImageUploadItem & { file?: File };
                  if (item.file) {
                    await handleAvatarUpload(item.file);
                  }
                }
              }}
              beforeUpload={beforeUpload}
              maxCount={1}
              upload={async (file: File) => {
                return await handleAvatarUpload(file);
              }}
            >
              <Button size="small" color="primary" fill="none">
                Change Avatar
              </Button>
            </ImageUploader>
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{user.name}</h2>
            <div className="profile-tags">
              <Space wrap>
                {user.roles?.map((role) => (
                  <Tag key={role.id} color="primary">
                    {role.name}
                  </Tag>
                ))}
                {user.is_admin && <Tag color="warning">Admin</Tag>}
                <Tag color={user.is_active ? 'success' : 'danger'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Tag>
              </Space>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="quick-actions-card">
        <div className="quick-actions">
          <Button
            color="primary"
            fill="solid"
            block
            onClick={() => {
              // Split name into first_name and last_name for the form
              const nameParts = user.name?.split(' ') || ['', ''];
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';

              editForm.setFieldsValue({
                first_name: firstName,
                last_name: lastName,
                email: user.email,
              });
              setEditProfileVisible(true);
            }}
          >
            <EditSOutline /> Edit Profile
          </Button>
          <Button
            color="default"
            fill="outline"
            block
            onClick={() => setChangePasswordVisible(true)}
          >
            <LockOutline /> Change Password
          </Button>
        </div>
      </Card>

      {/* Account Information */}
      <Card title="Account Information" className="info-card">
        <List>
          <List.Item
            prefix={<UserOutline />}
            extra={user.name}
          >
            Name
          </List.Item>
          <List.Item
            prefix={<MailOutline />}
            extra={user.email || 'N/A'}
          >
            Email
          </List.Item>
          <List.Item
            prefix={<FileOutline />}
            extra={user.employee_number}
          >
            Employee Number
          </List.Item>
          <List.Item
            prefix={<TeamOutline />}
            extra={user.department || 'N/A'}
          >
            Department
          </List.Item>
          <List.Item
            prefix={<UserOutline />}
            extra={
              <Space wrap>
                {user.roles?.map((role) => (
                  <Tag key={role.id} color="primary" style={{ fontSize: 12 }}>
                    {role.name}
                  </Tag>
                )) || 'N/A'}
              </Space>
            }
          >
            Roles
          </List.Item>
        </List>
      </Card>

      {/* Edit Profile Popup */}
      <Popup
        visible={editProfileVisible}
        onMaskClick={() => setEditProfileVisible(false)}
        bodyStyle={{ height: '60vh' }}
      >
        <div className="popup-content">
          <div className="popup-header">
            <h3>Edit Profile</h3>
          </div>
          <Form
            form={editForm}
            layout="vertical"
            footer={
              <div className="popup-footer">
                <Button
                  color="default"
                  fill="outline"
                  onClick={() => setEditProfileVisible(false)}
                  block
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  fill="solid"
                  onClick={handleEditProfile}
                  loading={isUpdating}
                  block
                >
                  Save Changes
                </Button>
              </div>
            }
          >
            <Form.Item
              name="first_name"
              label="First Name"
              rules={[
                { required: true, message: 'Please enter your first name' },
                { min: 2, message: 'First name must be at least 2 characters' },
              ]}
            >
              <Input placeholder="Enter your first name" />
            </Form.Item>
            <Form.Item
              name="last_name"
              label="Last Name"
              rules={[
                { required: true, message: 'Please enter your last name' },
                { min: 1, message: 'Last name is required' },
              ]}
            >
              <Input placeholder="Enter your last name" />
            </Form.Item>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { type: 'email', message: 'Please enter a valid email address' },
              ]}
            >
              <Input placeholder="Enter your email" type="email" />
            </Form.Item>
          </Form>
        </div>
      </Popup>

      {/* Change Password Popup */}
      <Popup
        visible={changePasswordVisible}
        onMaskClick={() => setChangePasswordVisible(false)}
        bodyStyle={{ height: '70vh' }}
      >
        <div className="popup-content">
          <div className="popup-header">
            <h3>Change Password</h3>
          </div>
          <Form
            form={passwordForm}
            layout="vertical"
            footer={
              <div className="popup-footer">
                <Button
                  color="default"
                  fill="outline"
                  onClick={() => setChangePasswordVisible(false)}
                  block
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  fill="solid"
                  onClick={handleChangePassword}
                  loading={isChangingPassword}
                  block
                >
                  Change Password
                </Button>
              </div>
            }
          >
            <Form.Item
              name="current_password"
              label="Current Password"
              rules={[
                { required: true, message: 'Please enter your current password' },
              ]}
            >
              <Input placeholder="Enter current password" type="password" />
            </Form.Item>
            <Form.Item
              name="new_password"
              label="New Password"
              rules={[
                { required: true, message: 'Please enter a new password' },
                { min: 8, message: 'Password must be at least 8 characters' },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Password must contain uppercase, lowercase, and number',
                },
              ]}
            >
              <Input placeholder="Enter new password" type="password" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="Confirm New Password"
              rules={[
                { required: true, message: 'Please confirm your new password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match'));
                  },
                }),
              ]}
            >
              <Input placeholder="Confirm new password" type="password" />
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
