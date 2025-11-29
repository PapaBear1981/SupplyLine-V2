import { useState } from 'react';
import {
  Card,
  Avatar,
  Typography,
  Space,
  Row,
  Col,
  Descriptions,
  Button,
  Upload,
  message,
  Tag,
  Spin,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  LockOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useAppSelector, useAppDispatch } from '@app/hooks';
import { setCredentials } from '@features/auth/slices/authSlice';
import { useUploadAvatarMutation } from '../services/profileApi';
import { EditProfileModal } from '../components/EditProfileModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

const { Title, Text } = Typography;

export const ProfilePage = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.token);
  const [uploadAvatar, { isLoading: isUploading }] = useUploadAvatarMutation();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const uploadProps: UploadProps = {
    name: 'avatar',
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('You can only upload image files!');
        return false;
      }
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        message.error('Image must be smaller than 2MB!');
        return false;
      }
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      const formData = new FormData();
      formData.append('avatar', file as File);

      try {
        const response = await uploadAvatar(formData).unwrap();

        // Update Redux state with new avatar
        if (user && token) {
          dispatch(setCredentials({
            user: { ...user, avatar: response.avatar_url },
            token,
          }));
        }

        message.success('Avatar updated successfully!');
        onSuccess?.(null);
      } catch (error) {
        message.error('Failed to upload avatar');
        onError?.(error as Error);
      }
    },
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '50px 0', textAlign: 'center' }}>
        <Spin size="large" tip="Loading profile..." />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>My Profile</Title>
          <Text type="secondary">Manage your account information and settings</Text>
        </div>

        {/* Profile Header Card */}
        <Card>
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} sm={8} md={6} style={{ textAlign: 'center' }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Avatar
                  size={120}
                  src={user.avatar}
                  icon={<UserOutlined />}
                  style={{ margin: '0 auto' }}
                />
                <Upload {...uploadProps}>
                  <Button
                    icon={<UploadOutlined />}
                    loading={isUploading}
                    size="small"
                  >
                    Change Avatar
                  </Button>
                </Upload>
              </Space>
            </Col>
            <Col xs={24} sm={16} md={18}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Title level={3} style={{ marginBottom: 4 }}>
                    {user.name}
                  </Title>
                  <Space size="small" wrap>
                    {user.roles && user.roles.length > 0 && (
                      <Tag color="blue">{user.roles[0].name}</Tag>
                    )}
                    <Tag color={user.is_active ? 'green' : 'red'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Tag>
                  </Space>
                </div>
                <Descriptions column={{ xs: 1, sm: 2 }}>
                  <Descriptions.Item label="Employee #">
                    {user.employee_number}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {user.email}
                  </Descriptions.Item>
                </Descriptions>
                <Space size="small" style={{ marginTop: 16 }}>
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    Edit Profile
                  </Button>
                  <Button
                    icon={<LockOutlined />}
                    onClick={() => setIsPasswordModalOpen(true)}
                  >
                    Change Password
                  </Button>
                </Space>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Account Information */}
        <Card title="Account Information">
          <Descriptions column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label="Name">
              {user.name}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {user.email}
            </Descriptions.Item>
            <Descriptions.Item label="Employee Number">
              {user.employee_number}
            </Descriptions.Item>
            <Descriptions.Item label="Role">
              {user.roles && user.roles.length > 0 ? user.roles[0].name : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Department">
              {user.department || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Account Status">
              <Tag color={user.is_active ? 'success' : 'error'}>
                {user.is_active ? 'Active' : 'Inactive'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="User ID">
              {user.id}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Space>

      {/* Modals */}
      <EditProfileModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={user}
      />
      <ChangePasswordModal
        open={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
