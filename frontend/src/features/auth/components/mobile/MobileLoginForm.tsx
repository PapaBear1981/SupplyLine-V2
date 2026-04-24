import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import { EyeInvisibleOutline, EyeOutline } from 'antd-mobile-icons';
import { ThunderboltFilled } from '@ant-design/icons';
import { AnimatePresence, motion } from 'framer-motion';
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

const TICKER_ITEMS = [
  { label: 'Tool crib', status: 'Online', tone: 'good' as const },
  { label: 'Inventory sync', status: '99.2%', tone: 'good' as const },
  { label: 'Checkouts today', status: '47', tone: 'accent' as const },
  { label: 'Calibration due', status: '3 tools', tone: 'warn' as const },
];

const TICKER_INTERVAL_MS = 3800;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const MobileLoginForm = ({ onSuccess }: MobileLoginFormProps) => {
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [login, { isLoading }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [form] = Form.useForm();

  // Redirect to dashboard if already authenticated (e.g. warm refresh)
  useEffect(() => {
    if (isAuthenticated) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(
      () => setTickerIndex((i) => (i + 1) % TICKER_ITEMS.length),
      TICKER_INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, []);

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

  const currentTicker = TICKER_ITEMS[tickerIndex];

  return (
    <MobileAuthShell>
      <div className="mobile-login-form" data-testid="login-form">
        <div className="mobile-login-brand" aria-hidden="true">
          <span className="mobile-login-brand-dot" />
          <span className="mobile-login-brand-word">SUPPLYLINE</span>
          <span className="mobile-login-brand-chip">MRO</span>
        </div>

        <div className="mobile-login-header">
          <div className="mobile-login-mark" aria-hidden="true">
            <ThunderboltFilled />
          </div>
          <h1 className="mobile-login-title">Welcome back</h1>
          <p className="mobile-login-subtitle">
            Sign in to pick up your tool checkouts, kits, and inventory.
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

        <div className="mobile-login-hero">
          <p className="mobile-login-hero-headline">
            Keep the right tool in the right hand at the{' '}
            <span className="mobile-login-hero-accent">right time.</span>
          </p>

          <div className="mobile-login-ticker" aria-hidden="true">
            <span className="mobile-login-ticker-rail" />
            <AnimatePresence initial={false}>
              <motion.div
                key={currentTicker.label}
                className="mobile-login-ticker-row"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, position: 'absolute' }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <span className={`mobile-login-ticker-dot tone-${currentTicker.tone}`} />
                <span className="mobile-login-ticker-label">{currentTicker.label}</span>
                <span className="mobile-login-ticker-sep">·</span>
                <span className={`mobile-login-ticker-status tone-${currentTicker.tone}`}>
                  {currentTicker.status}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mobile-login-hero-foot">
            <span>© {new Date().getFullYear()} SupplyLine</span>
            <span className="mobile-login-hero-foot-sep">·</span>
            <span>Flight Deck</span>
          </div>
        </div>
      </div>
    </MobileAuthShell>
  );
};
