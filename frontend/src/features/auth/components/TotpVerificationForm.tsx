import { Form, Input, Button, Checkbox, Typography, message } from 'antd';
import { SafetyCertificateOutlined, ArrowLeftOutlined, KeyOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useVerifyTotpMutation } from '../services/authApi';
import { formVariants, buttonHover, buttonTap } from '../styles/animations';
import type { LoginResponse } from '../types';
import './TotpVerificationForm.css';

const { Title, Text, Paragraph } = Typography;

interface TotpVerificationFormProps {
  employeeNumber: string;
  onBack: () => void;
  onSuccess?: (response: LoginResponse) => void;
  onUseBackupCode?: () => void;
}

export const TotpVerificationForm = ({
  employeeNumber,
  onBack,
  onSuccess,
  onUseBackupCode
}: TotpVerificationFormProps) => {
  const [verifyTotp, { isLoading }] = useVerifyTotpMutation();

  const handleSubmit = async (values: { code: string; trust_device?: boolean }) => {
    try {
      const result = await verifyTotp({
        employee_number: employeeNumber,
        code: values.code,
        trust_device: Boolean(values.trust_device),
      }).unwrap();

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'data' in error) {
        const apiError = error as { data?: { error?: string } };
        message.error(apiError.data?.error || 'Invalid verification code');
      } else {
        message.error('An unexpected error occurred');
      }
    }
  };

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      className="totp-verification-container"
      data-testid="totp-form"
    >
      <div className="totp-verification-header">
        <SafetyCertificateOutlined className="totp-icon" />
        <Title level={2} style={{ marginBottom: 8 }}>
          Two-Factor Authentication
        </Title>
        <Text type="secondary">
          Enter the 6-digit code from your authenticator app
        </Text>
      </div>

      <Form
        name="totp-verify"
        onFinish={handleSubmit}
        autoComplete="off"
        layout="vertical"
        requiredMark={false}
        className="totp-verification-form"
      >
        <Paragraph type="secondary" className="totp-instructions">
          Open your authenticator app (Google Authenticator, Authy, etc.) and enter the code for SupplyLine MRO.
        </Paragraph>

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
            placeholder="000000"
            maxLength={6}
            className="glass-input totp-code-input"
            autoFocus
            data-testid="totp-code-input"
          />
        </Form.Item>

        <Form.Item
          name="trust_device"
          valuePropName="checked"
          style={{ marginBottom: 12 }}
        >
          <Checkbox>
            Trust this device for 30 days (skip 2FA next time)
          </Checkbox>
        </Form.Item>
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 16 }}>
          Only enable on devices you control. You can revoke trusted devices from your profile.
        </Text>

        <Form.Item style={{ marginBottom: 16 }}>
          <motion.div whileHover={buttonHover} whileTap={buttonTap}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              size="large"
              className="glass-button totp-submit-button"
              data-testid="totp-submit"
            >
              Verify Code
            </Button>
          </motion.div>
        </Form.Item>

        {onUseBackupCode && (
          <div className="totp-backup-code-link">
            <Button
              type="link"
              icon={<KeyOutlined />}
              onClick={onUseBackupCode}
              className="backup-code-button"
            >
              Use backup code instead
            </Button>
          </div>
        )}

        <div className="totp-back-link">
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
          >
            Back to login
          </Button>
        </div>
      </Form>

      <div className="totp-help-text">
        <Text type="secondary">
          Having trouble? Contact <a href="mailto:support@supplyline.aero">support@supplyline.aero</a> for assistance.
        </Text>
      </div>
    </motion.div>
  );
};
