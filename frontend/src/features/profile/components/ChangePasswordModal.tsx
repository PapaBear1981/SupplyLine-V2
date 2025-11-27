import { Modal, Form, Input, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useChangePasswordMutation } from '../services/profileApi';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export const ChangePasswordModal = ({ open, onClose }: ChangePasswordModalProps) => {
  const [form] = Form.useForm();
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const handleSubmit = async (values: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) => {
    try {
      await changePassword(values).unwrap();
      message.success('Password changed successfully!');
      form.resetFields();
      onClose();
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to change password');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Change Password"
      open={open}
      onOk={form.submit}
      onCancel={handleCancel}
      confirmLoading={isLoading}
      okText="Change Password"
      cancelText="Cancel"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          label="Current Password"
          name="current_password"
          rules={[
            { required: true, message: 'Please enter your current password' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Enter current password"
          />
        </Form.Item>

        <Form.Item
          label="New Password"
          name="new_password"
          rules={[
            { required: true, message: 'Please enter a new password' },
            { min: 8, message: 'Password must be at least 8 characters' },
            {
              pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
              message: 'Password must contain uppercase, lowercase, and number',
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Enter new password"
          />
        </Form.Item>

        <Form.Item
          label="Confirm New Password"
          name="confirm_password"
          dependencies={['new_password']}
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
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Confirm new password"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
