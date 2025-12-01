import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import { EyeInvisibleOutline, EyeOutline } from 'antd-mobile-icons';
import { useLoginMutation } from '../../services/authApi';
import { useAppDispatch } from '@app/hooks';
import { setCredentials } from '../../slices/authSlice';
import { socketService } from '@services/socket';
import { ROUTES } from '@shared/constants/routes';
import type { LoginRequest } from '../../types';
import './MobileLoginForm.css';

export const MobileLoginForm = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const result = await login(values as LoginRequest).unwrap();
      dispatch(setCredentials({ user: result.user, token: result.access_token }));

      // Establish WebSocket connection for real-time features
      try {
        socketService.connect(result.access_token);
      } catch (socketError) {
        console.warn('WebSocket connection failed:', socketError);
        // Don't block login if WebSocket fails
      }

      Toast.show({
        icon: 'success',
        content: 'Welcome back. Launch checklist complete.',
        duration: 2000,
      });
      navigate(ROUTES.DASHBOARD);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status: number; data?: { error?: string } };
        Toast.show({
          icon: 'fail',
          content: apiError.data?.error || 'Login failed. Please check your credentials.',
          duration: 3000,
        });
      } else {
        Toast.show({
          icon: 'fail',
          content: 'An unexpected error occurred',
          duration: 3000,
        });
      }
    }
  };

  return (
    <div className="mobile-login-form">
      <div className="mobile-login-header">
        <h1 className="mobile-login-title">Welcome back</h1>
        <p className="mobile-login-subtitle">
          Continue where you left off—dispatching drops, monitoring hangars, and coordinating crews.
        </p>
      </div>

      <Form
        form={form}
        layout="vertical"
        footer={
          <Button
            type="submit"
            color="primary"
            size="large"
            block
            loading={isLoading}
            onClick={handleSubmit}
          >
            Log In
          </Button>
        }
      >
        <Form.Item
          name="employee_number"
          label="Employee Number"
          rules={[{ required: true, message: 'Please input your employee number!' }]}
        >
          <Input
            placeholder="e.g. 00421"
            clearable
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Please input your password!' }]}
          extra={
            <div className="mobile-login-extra">
              <a
                href="mailto:support@supplyline.aero?subject=Password%20reset"
                className="mobile-login-link"
              >
                Forgot password?
              </a>
            </div>
          }
        >
          <div className="password-input-wrapper">
            <Input
              placeholder="Enter your password"
              clearable
              type={showPassword ? 'text' : 'password'}
              autoComplete="off"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOutline /> : <EyeInvisibleOutline />}
            </button>
          </div>
        </Form.Item>
      </Form>

      <div className="mobile-login-footer">
        <p className="mobile-login-help">
          Need an account?{' '}
          <a
            href="mailto:support@supplyline.aero?subject=Create%20my%20SupplyLine%20account"
            className="mobile-login-link"
          >
            Contact support
          </a>
        </p>
      </div>

      <div className="mobile-login-info">
        <div className="mobile-login-info-title">Flightline insight at a glance</div>
        <p className="mobile-login-info-text">
          Stay ahead of supply gaps with kit readiness alerts, mission timelines, and maintenance
          holds surfaced instantly on login.
        </p>
      </div>
    </div>
  );
};
