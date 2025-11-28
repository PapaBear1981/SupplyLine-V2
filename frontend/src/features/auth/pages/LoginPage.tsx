import { Form, Input, Button, Typography, Divider, message } from 'antd';
import { UserOutlined, LockOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../services/authApi';
import { useAppDispatch } from '@app/hooks';
import { setCredentials } from '../slices/authSlice';
import { ROUTES } from '@shared/constants/routes';
import type { LoginRequest } from '../types';
import './LoginPage.css';

const { Title, Text } = Typography;

export const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const handleSubmit = async (values: LoginRequest) => {
    try {
      const result = await login(values).unwrap();
      dispatch(setCredentials({ user: result.user, token: result.access_token }));
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
            prefix={<UserOutlined />}
            placeholder="e.g. 00421"
            autoFocus
          />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: 'Please input your password!' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="Enter your password"
          />
        </Form.Item>

        <div className="login-actions">
          <Button type="link" href="mailto:support@supplyline.aero?subject=Password%20reset">
            Forgot password?
          </Button>
          <Button
            type="link"
            href="mailto:support@supplyline.aero?subject=Create%20my%20SupplyLine%20account"
            icon={<ArrowRightOutlined />}
          >
            Request account
          </Button>
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
