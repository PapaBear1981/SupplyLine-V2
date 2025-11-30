import { Form, Input, Button, Typography, Space, message } from 'antd';
import { SafetyCertificateOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useVerifyTotpMutation } from '../services/authApi';
import { useAppDispatch } from '@app/hooks';
import { setCredentials } from '../slices/authSlice';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@shared/constants/routes';

const { Title, Text, Paragraph } = Typography;

interface TotpVerificationFormProps {
  employeeNumber: string;
  onBack: () => void;
}

export const TotpVerificationForm = ({ employeeNumber, onBack }: TotpVerificationFormProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [verifyTotp, { isLoading }] = useVerifyTotpMutation();

  const handleSubmit = async (values: { code: string }) => {
    try {
      const result = await verifyTotp({
        employee_number: employeeNumber,
        code: values.code,
      }).unwrap();

      dispatch(setCredentials({ user: result.user, token: result.access_token }));
      message.success('Welcome back. Launch checklist complete.');
      navigate(ROUTES.DASHBOARD);
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
    <div className="login-wrapper">
      <div className="login-header">
        <Title level={3} style={{ marginBottom: 6 }}>
          <SafetyCertificateOutlined style={{ marginRight: 8 }} />
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
        size="large"
        layout="vertical"
        requiredMark={false}
        className="login-form"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Open your authenticator app and enter the code for SupplyLine MRO.
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
              style={{
                textAlign: 'center',
                letterSpacing: 8,
                fontSize: 24,
                background: 'rgba(15, 35, 55, 0.6)',
                border: '1px solid rgba(94, 165, 255, 0.25)',
                color: '#f7fbff',
              }}
              styles={{
                input: {
                  background: 'transparent',
                  color: '#f7fbff',
                  textAlign: 'center',
                },
              }}
              autoFocus
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
            >
              Verify
            </Button>
          </Form.Item>

          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            style={{ padding: 0 }}
          >
            Back to login
          </Button>
        </Space>
      </Form>

      <div className="login-footnote" style={{ marginTop: 24 }}>
        <Text type="secondary">
          Having trouble? Contact support@supplyline.aero for assistance.
        </Text>
      </div>
    </div>
  );
};
