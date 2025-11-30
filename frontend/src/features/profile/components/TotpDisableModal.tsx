import { Modal, Form, Input, message, Typography, Alert } from 'antd';
import { LockOutlined, WarningOutlined } from '@ant-design/icons';
import { useDisableTotpMutation } from '@features/auth/services/authApi';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { setCredentials } from '@features/auth/slices/authSlice';

const { Paragraph } = Typography;

interface TotpDisableModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TotpDisableModal = ({ open, onClose, onSuccess }: TotpDisableModalProps) => {
  const [form] = Form.useForm();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.token);

  const [disableTotp, { isLoading }] = useDisableTotpMutation();

  const handleSubmit = async (values: { password: string }) => {
    try {
      await disableTotp({ password: values.password }).unwrap();
      message.success('Two-factor authentication has been disabled.');

      // Update user state to reflect TOTP is now disabled
      if (user && token) {
        dispatch(setCredentials({
          user: { ...user, is_totp_enabled: false },
          token,
        }));
      }

      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err?.data?.error || 'Failed to disable 2FA');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <>
          <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
          Disable Two-Factor Authentication
        </>
      }
      open={open}
      onOk={form.submit}
      onCancel={handleCancel}
      confirmLoading={isLoading}
      okText="Disable 2FA"
      okButtonProps={{ danger: true }}
      cancelText="Cancel"
    >
      <Alert
        message="Security Warning"
        description="Disabling two-factor authentication will make your account less secure. Anyone with your password will be able to access your account."
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Paragraph>
        To confirm this action, please enter your password:
      </Paragraph>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          label="Password"
          name="password"
          rules={[
            { required: true, message: 'Please enter your password to confirm' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Enter your password"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
