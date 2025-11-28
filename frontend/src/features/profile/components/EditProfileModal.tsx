import { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import type { User } from '@features/auth/types';
import { useUpdateProfileMutation } from '../services/profileApi';
import { useAppDispatch } from '@app/hooks';
import { setCredentials } from '@features/auth/slices/authSlice';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
}

export const EditProfileModal = ({ open, onClose, user }: EditProfileModalProps) => {
  const [form] = Form.useForm();
  const dispatch = useAppDispatch();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
      });
    }
  }, [open, user, form]);

  const handleSubmit = async (values: { name: string; email: string }) => {
    try {
      const updatedUser = await updateProfile(values).unwrap();

      // Update the user in Redux state
      const token = localStorage.getItem('access_token');
      if (token) {
        dispatch(setCredentials({ user: updatedUser, token }));
      }

      message.success('Profile updated successfully!');
      onClose();
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Edit Profile"
      open={open}
      onOk={form.submit}
      onCancel={handleCancel}
      confirmLoading={isLoading}
      okText="Save Changes"
      cancelText="Cancel"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: 'Please enter your name' },
            { min: 2, message: 'Name must be at least 2 characters' },
          ]}
        >
          <Input placeholder="Enter your name" />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { type: 'email', message: 'Please enter a valid email address' },
          ]}
        >
          <Input placeholder="Enter your email" type="email" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
