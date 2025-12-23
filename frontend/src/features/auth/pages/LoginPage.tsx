import { Form, Input, Button, Typography, Divider, message } from 'antd';
import { UserOutlined, LockOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useLoginMutation } from '../services/authApi';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { setCredentials } from '../slices/authSlice';
import { socketService } from '@services/socket';
import { ROUTES } from '@shared/constants/routes';
import { useIsMobile } from '@shared/hooks/useMobile';
import { MobileLoginForm } from '../components/mobile';
import type { LoginRequest } from '../types';
import './LoginPage.css';

const { Title, Text } = Typography;

export const LoginPage = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [login, { isLoading }] = useLoginMutation();

  // Redirect to dashboard if already authenticated (skip for mobile since MobileLoginForm handles it)
  useEffect(() => {
    if (isAuthenticated && !isMobile) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [isAuthenticated, navigate, isMobile]);

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileLoginForm />;
  }

  const handleSubmit = async (values: LoginRequest) => {
    try {
      const result = await login(values).unwrap();
      dispatch(setCredentials({ user: result.user, token: result.access_token }));

      // Establish WebSocket connection for real-time features
      try {
        socketService.connect(result.access_token);
      } catch (socketError) {
        console.warn('WebSocket connection failed:', socketError);
        // Don't block login if WebSocket fails
      }

      message.success('Welcome back. Launch checklist complete.');
      navigate(ROUTES.DASHBOARD);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status: number; data?: { error?: string } };
        message.error(
          apiError.data?.error || 'Login failed. Please check your credentials.'
        );
      } else {
        message.error('An unexpected error occurred');
      }
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-header">
        <Title level={3} style={{ marginBottom: 6 }}>
          Welcome back
        </Title>
        <Text type="secondary">
          Continue where you left off—dispatching drops, monitoring hangars, and coordinating crews.
        </Text>
      </div>

      <Form
        name="login"
        onFinish={handleSubmit}
        autoComplete="off"
        size="large"
        layout="vertical"
        requiredMark={false}
        className="login-form"
      >
        <Form.Item
          label="Employee Number"
          name="employee_number"
          rules={[
            { required: true, message: 'Please input your employee number!' },
          ]}
        >
          <Input
            prefix={<UserOutlined style={{ color: 'rgba(229, 239, 255, 0.5)' }} />}
            placeholder="e.g. 00421"
            autoFocus
            style={{
              background: 'rgba(15, 35, 55, 0.6)',
              border: '1px solid rgba(94, 165, 255, 0.25)',
              color: '#f7fbff'
            }}
            styles={{
              input: {
                background: 'transparent',
                color: '#f7fbff'
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: 'Please input your password!' }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: 'rgba(229, 239, 255, 0.5)' }} />}
            placeholder="Enter your password"
            style={{
              background: 'rgba(15, 35, 55, 0.6)',
              border: '1px solid rgba(94, 165, 255, 0.25)',
              color: '#f7fbff'
            }}
            styles={{
              input: {
                background: 'transparent',
                color: '#f7fbff'
              }
            }}
          />
        </Form.Item>

        <div className="login-actions">
          <div>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Forgot password? Email:{' '}
            </Text>
            <Button
              type="link"
              href="mailto:support@supplyline.aero?subject=Password%20reset"
              style={{ padding: 0, height: 'auto', fontSize: '13px' }}
            >
              support@supplyline.aero
            </Button>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Request account:{' '}
            </Text>
            <Button
              type="link"
              href="mailto:support@supplyline.aero?subject=Create%20my%20SupplyLine%20account"
              style={{ padding: 0, height: 'auto', fontSize: '13px' }}
              icon={<ArrowRightOutlined />}
            >
              support@supplyline.aero
            </Button>
          </div>
        </div>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            block
          >
            Log In
          </Button>
        </Form.Item>
      </Form>

      <Divider plain style={{ marginTop: 22, marginBottom: 10 }}>
        Flightline insight at a glance
      </Divider>
      <div className="login-footnote">
        <Text type="secondary">
          Stay ahead of supply gaps with kit readiness alerts, mission timelines, and maintenance holds surfaced instantly on login.
        </Text>
      </div>
    </div>
  );
};
