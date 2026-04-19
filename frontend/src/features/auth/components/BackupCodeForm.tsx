import { useState } from 'react';
import { Form, Input, Button, Checkbox, Typography, Alert, Space, message } from 'antd';
import { SafetyCertificateOutlined, ArrowLeftOutlined, KeyOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useVerifyBackupCodeMutation } from '../services/authApi';
import type { BackupCodeVerifyResponse } from '../types';
import './BackupCodeForm.css';

const { Title, Text, Paragraph } = Typography;

interface BackupCodeFormProps {
  employeeNumber: string;
  onBack: () => void;
  onSuccess: (response: BackupCodeVerifyResponse) => void;
}

export const BackupCodeForm = ({ employeeNumber, onBack, onSuccess }: BackupCodeFormProps) => {
  const [form] = Form.useForm();
  const [verifyBackupCode, { isLoading }] = useVerifyBackupCodeMutation();
  const [error, setError] = useState<string>('');

  const handleSubmit = async (values: { code: string; trust_device?: boolean }) => {
    try {
      setError('');
      const result = await verifyBackupCode({
        employee_number: employeeNumber,
        code: values.code.trim().toUpperCase(),
        trust_device: Boolean(values.trust_device),
      }).unwrap();

      const codesRemaining = result.codes_remaining || 0;
      if (codesRemaining === 0) {
        message.warning(
          'You have used all backup codes. Please generate new ones in your profile settings.'
        );
      } else if (codesRemaining <= 3) {
        message.warning(
          `You have ${codesRemaining} backup code${codesRemaining === 1 ? '' : 's'} remaining. Consider generating new ones.`
        );
      } else {
        message.success(`Welcome back. ${codesRemaining} backup codes remaining.`);
      }

      onSuccess(result);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err) {
        const apiError = err as { status: number; data?: { error?: string; code?: string } };
        setError(apiError.data?.error || 'Invalid backup code. Please try again.');
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="backup-code-form-wrapper"
    >
      <div className="backup-code-form-header">
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          className="back-button"
        >
          Back to 2FA
        </Button>

        <Space direction="vertical" size="small" align="center" style={{ width: '100%' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <div className="backup-icon">
              <KeyOutlined />
            </div>
          </motion.div>

          <Title level={3} style={{ marginBottom: 6, marginTop: 16 }}>
            Use Backup Code
          </Title>
          <Text type="secondary">
            Enter one of your backup codes to access your account
          </Text>
        </Space>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert
            message="Verification Failed"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError('')}
            style={{ marginBottom: 24 }}
          />
        </motion.div>
      )}

      <Alert
        message="About Backup Codes"
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Each backup code can only be used once</li>
            <li>Codes are 8 characters long</li>
            <li>Codes are not case-sensitive</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        name="backup_code"
        onFinish={handleSubmit}
        layout="vertical"
        autoComplete="off"
        size="large"
        requiredMark={false}
      >
        <Form.Item
          label="Backup Code"
          name="code"
          rules={[
            { required: true, message: 'Please enter a backup code' },
            {
              pattern: /^[A-Z0-9]{8}$/i,
              message: 'Backup code must be exactly 8 characters',
            },
          ]}
        >
          <Input
            prefix={<SafetyCertificateOutlined style={{ color: 'rgba(229, 239, 255, 0.5)' }} />}
            placeholder="e.g. ABC12345"
            autoFocus
            maxLength={8}
            onChange={(e) => {
              // Auto-uppercase for better UX
              const value = e.target.value.toUpperCase();
              form.setFieldsValue({ code: value });
            }}
            style={{
              background: 'rgba(15, 35, 55, 0.6)',
              border: '1px solid rgba(94, 165, 255, 0.25)',
              color: '#f7fbff',
              fontFamily: "'Courier New', monospace",
              fontSize: '18px',
              letterSpacing: '4px',
              textAlign: 'center',
            }}
            styles={{
              input: {
                background: 'transparent',
                color: '#f7fbff',
              },
            }}
          />
        </Form.Item>

        <Form.Item
          name="trust_device"
          valuePropName="checked"
          style={{ marginBottom: 8 }}
        >
          <Checkbox>
            Trust this device for 30 days (skip 2FA next time)
          </Checkbox>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={isLoading} block>
            Verify Backup Code
          </Button>
        </Form.Item>
      </Form>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Paragraph type="secondary" style={{ fontSize: '13px' }}>
          Lost your backup codes?{' '}
          <Button
            type="link"
            href="mailto:support@supplyline.aero?subject=Lost%20Backup%20Codes"
            style={{ padding: 0, height: 'auto', fontSize: '13px' }}
          >
            Contact support
          </Button>
        </Paragraph>
      </div>
    </motion.div>
  );
};
