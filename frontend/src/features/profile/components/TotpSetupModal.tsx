import { useState } from 'react';
import { Modal, Form, Input, message, Steps, Typography, Space, Alert, Spin } from 'antd';
import { SafetyCertificateOutlined, QrcodeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import {
  useSetupTotpMutation,
  useVerifyTotpSetupMutation,
} from '@features/auth/services/authApi';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { setCredentials } from '@features/auth/slices/authSlice';

const { Text, Paragraph } = Typography;

interface TotpSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TotpSetupModal = ({ open, onClose, onSuccess }: TotpSetupModalProps) => {
  const [form] = Form.useForm();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.token);

  const [currentStep, setCurrentStep] = useState(0);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const [setupTotp, { isLoading: isSettingUp }] = useSetupTotpMutation();
  const [verifyTotpSetup, { isLoading: isVerifying }] = useVerifyTotpSetupMutation();

  const handleSetupStart = async () => {
    try {
      const result = await setupTotp().unwrap();
      setQrCode(result.qr_code);
      setCurrentStep(1);
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err?.data?.error || 'Failed to start 2FA setup');
    }
  };

  const handleVerify = async (values: { code: string }) => {
    try {
      await verifyTotpSetup({ code: values.code }).unwrap();
      message.success('Two-factor authentication enabled successfully!');

      // Update user state to reflect TOTP is now enabled
      if (user && token) {
        dispatch(setCredentials({
          user: { ...user, is_totp_enabled: true },
          token,
        }));
      }

      setCurrentStep(2);

      // Call onSuccess after a brief delay to show the success step
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2000);
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err?.data?.error || 'Invalid verification code');
    }
  };

  const handleClose = () => {
    form.resetFields();
    setCurrentStep(0);
    setQrCode(null);
    onClose();
  };

  const steps = [
    {
      title: 'Get Started',
      icon: <SafetyCertificateOutlined />,
    },
    {
      title: 'Scan QR Code',
      icon: <QrcodeOutlined />,
    },
    {
      title: 'Complete',
      icon: <CheckCircleOutlined />,
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              message="Enhance Your Account Security"
              description="Two-factor authentication adds an extra layer of security to your account. You'll need an authenticator app like Google Authenticator, Authy, or 1Password."
              type="info"
              showIcon
            />
            <Paragraph>
              <Text strong>Before you begin, make sure you have:</Text>
            </Paragraph>
            <ul style={{ paddingLeft: 20 }}>
              <li>An authenticator app installed on your phone</li>
              <li>Access to your phone during login</li>
            </ul>
            <Paragraph type="secondary">
              Recommended apps: Google Authenticator, Microsoft Authenticator, Authy, 1Password
            </Paragraph>
          </Space>
        );

      case 1:
        return (
          <Space direction="vertical" size="middle" style={{ width: '100%', alignItems: 'center' }}>
            {isSettingUp ? (
              <Spin size="large" tip="Generating QR code..." />
            ) : qrCode ? (
              <>
                <Text strong>Scan this QR code with your authenticator app:</Text>
                <div style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
                  <img
                    src={qrCode}
                    alt="TOTP QR Code"
                    style={{ maxWidth: 200, maxHeight: 200 }}
                  />
                </div>
                <Alert
                  message="Keep this secure!"
                  description="Do not share this QR code with anyone. It grants access to your account."
                  type="warning"
                  showIcon
                />
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleVerify}
                  style={{ width: '100%', maxWidth: 300 }}
                >
                  <Form.Item
                    label="Verification Code"
                    name="code"
                    rules={[
                      { required: true, message: 'Please enter the 6-digit code' },
                      { len: 6, message: 'Code must be exactly 6 digits' },
                      { pattern: /^\d+$/, message: 'Code must contain only numbers' },
                    ]}
                  >
                    <Input
                      size="large"
                      placeholder="000000"
                      maxLength={6}
                      style={{ textAlign: 'center', letterSpacing: 8, fontSize: 18 }}
                    />
                  </Form.Item>
                </Form>
              </>
            ) : null}
          </Space>
        );

      case 2:
        return (
          <Space direction="vertical" size="middle" style={{ width: '100%', alignItems: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
            <Text strong style={{ fontSize: 18 }}>
              Two-Factor Authentication Enabled!
            </Text>
            <Paragraph type="secondary" style={{ textAlign: 'center' }}>
              Your account is now protected with 2FA. You'll need to enter a code from your
              authenticator app each time you log in.
            </Paragraph>
          </Space>
        );

      default:
        return null;
    }
  };

  const getModalFooterProps = () => {
    if (currentStep === 0) {
      return {
        okText: 'Begin Setup',
        onOk: handleSetupStart,
        confirmLoading: isSettingUp,
      };
    }
    if (currentStep === 1) {
      return {
        okText: 'Verify',
        onOk: form.submit,
        confirmLoading: isVerifying,
      };
    }
    return {
      footer: null,
    };
  };

  return (
    <Modal
      title="Set Up Two-Factor Authentication"
      open={open}
      onCancel={handleClose}
      width={500}
      {...getModalFooterProps()}
    >
      <Steps
        current={currentStep}
        items={steps}
        size="small"
        style={{ marginBottom: 24 }}
      />
      {renderStepContent()}
    </Modal>
  );
};
