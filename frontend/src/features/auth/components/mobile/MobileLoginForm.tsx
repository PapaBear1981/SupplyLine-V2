import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import { EyeInvisibleOutline, EyeOutline } from 'antd-mobile-icons';
import { useLoginMutation } from '../../services/authApi';
import { useAppSelector } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';
import type { LoginRequest, LoginResponse } from '../../types';
import { MobileAuthShell } from './MobileAuthShell';
import '../../styles/glassmorphism.css';
import './MobileLoginForm.css';

interface MobileLoginFormProps {
  /**
   * Called after the credentials API call succeeds, regardless of whether
   * the backend returned a session token or a TOTP challenge. The parent
   * (LoginPage) decides what to do next (dashboard redirect, TOTP prompt,
   * backup-code fallback).
   */
  onSuccess: (response: LoginResponse) => void;
}

export const MobileLoginForm = ({ onSuccess }: MobileLoginFormProps) => {
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [login, { isLoading }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [form] = Form.useForm();

  // Redirect to dashboard if already authenticated (e.g. warm refresh)
  useEffect(() => {
    if (isAuthenticated) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const result = await login(values as LoginRequest).unwrap();
      onSuccess(result);
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
    <MobileAuthShell>
      <div className="mobile-login-form" data-testid="login-form">
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
            data-testid="login-submit"
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
            data-testid="login-username"
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
              data-testid="login-password"
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
    </MobileAuthShell>
  );
};
