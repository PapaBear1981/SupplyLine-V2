import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { message } from 'antd';
import { Toast } from 'antd-mobile';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { setCredentials, setSetupToken } from '../slices/authSlice';
import { socketService } from '@services/socket';
import { ROUTES } from '@shared/constants/routes';
import { useIsMobile } from '@shared/hooks/useMobile';
import {
  MobileLoginForm,
  MobileTotpVerification,
  MobileBackupCodeForm,
} from '../components/mobile';
import { LoginForm } from '../components/login/LoginForm';
import { LoginHero } from '../components/login/LoginHero';
import { ForcedTotpSetup } from '../components/login/ForcedTotpSetup';
import { TotpVerificationForm } from '../components/TotpVerificationForm';
import { BackupCodeForm } from '../components/BackupCodeForm';
import { pageVariants } from '../styles/animations';
import type { LoginResponse } from '../types';
import '../styles/glassmorphism.css';
import './LoginPage.css';

type LoginState =
  | 'PASSWORD_ENTRY'
  | 'TOTP_SETUP'
  | 'TOTP_VERIFICATION'
  | 'BACKUP_CODE_ENTRY'
  | 'AUTHENTICATED';

export const LoginPage = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  const [loginState, setLoginState] = useState<LoginState>('PASSWORD_ENTRY');
  const [loginResponse, setLoginResponse] = useState<LoginResponse | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState<string>('');

  // Redirect if already authenticated AND not in TOTP setup/verification flow
  useEffect(() => {
    if (isAuthenticated && loginState === 'PASSWORD_ENTRY') {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [isAuthenticated, navigate, loginState]);

  const handleLoginSuccess = (response: LoginResponse) => {
    setLoginResponse(response);
    setEmployeeNumber(response.employee_number || '');

    // Check if user needs to set up TOTP (first-time mandatory enrollment)
    if (response.requires_totp_setup) {
      // Store the setup token for TOTP API calls BUT don't set isAuthenticated
      // This prevents refresh bypass vulnerability
      dispatch(
        setSetupToken({
          user: response.user,
          token: response.setup_token || '',
          expiresIn: 3600, // 1 hour
        })
      );
      setLoginState('TOTP_SETUP');
      return;
    }

    // Check if user needs to verify TOTP (returning user with 2FA enabled)
    if (response.requires_totp) {
      setLoginState('TOTP_VERIFICATION');
      return;
    }

    // Normal login flow (no TOTP required - should not happen with mandatory 2FA)
    completeAuthentication(response);
  };

  const completeAuthentication = (response: LoginResponse) => {
    dispatch(
      setCredentials({
        user: response.user,
        token: response.access_token,
        expiresIn: response.expires_in,
      })
    );

    // Establish WebSocket connection
    try {
      socketService.connect(response.access_token);
    } catch (socketError) {
      console.warn('WebSocket connection failed:', socketError);
      // Don't block login if WebSocket fails
    }

    if (isMobile) {
      Toast.show({ icon: 'success', content: 'Welcome back', duration: 2000 });
    } else {
      message.success('Welcome back. Launch checklist complete.');
    }
    setLoginState('AUTHENTICATED');
    navigate(ROUTES.DASHBOARD);
  };

  const handleTotpVerified = (response: LoginResponse) => {
    completeAuthentication(response);
  };

  const handleBackupCodeSwitch = () => {
    setLoginState('BACKUP_CODE_ENTRY');
  };

  const handleBackToPassword = () => {
    setLoginState('PASSWORD_ENTRY');
    setLoginResponse(null);
    setEmployeeNumber('');
  };

  const handleBackToTotp = () => {
    setLoginState('TOTP_VERIFICATION');
  };

  // ---------- Mobile rendering ------------------------------------------------
  if (isMobile) {
    if (loginState === 'PASSWORD_ENTRY') {
      return <MobileLoginForm onSuccess={handleLoginSuccess} />;
    }

    if (loginState === 'TOTP_SETUP' && loginResponse) {
      // Reuse desktop ForcedTotpSetup on mobile — it already ships with
      // glass-card-elevated styling and works reasonably well on mobile
      // viewports. A dedicated mobile TOTP enrollment flow can follow in
      // a later iteration.
      return <ForcedTotpSetup />;
    }

    if (loginState === 'TOTP_VERIFICATION') {
      return (
        <MobileTotpVerification
          employeeNumber={employeeNumber}
          onSuccess={handleTotpVerified}
          onBack={handleBackToPassword}
          onUseBackupCode={handleBackupCodeSwitch}
        />
      );
    }

    if (loginState === 'BACKUP_CODE_ENTRY') {
      return (
        <MobileBackupCodeForm
          employeeNumber={employeeNumber}
          onSuccess={completeAuthentication}
          onBack={handleBackToTotp}
        />
      );
    }

    // AUTHENTICATED — navigation is in-flight, render nothing.
    return null;
  }

  // ---------- Desktop rendering ---------------------------------------------
  // The login page is always dark-themed regardless of the user's global theme
  // preference. `data-theme="dark"` scopes the dark CSS variables to this
  // subtree only.
  if (loginState === 'TOTP_SETUP' && loginResponse) {
    return (
      <div className="login-page" data-theme="dark">
        <div className="login-bg-orbs" aria-hidden="true" />
        <div className="login-bg-grid" aria-hidden="true" />
        <motion.div
          key="totp-setup"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="totp-setup-fullscreen"
        >
          <ForcedTotpSetup />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="login-page" data-theme="dark" data-testid="login-page">
      <div className="login-bg-orbs" aria-hidden="true" />
      <div className="login-bg-grid" aria-hidden="true" />

      <div className="login-shell">
        <aside className="login-hero" data-testid="login-hero">
          <LoginHero />
        </aside>

        <section className="login-panel">
          <div className="login-panel-inner">
            <AnimatePresence mode="wait">
              {loginState === 'PASSWORD_ENTRY' && (
                <motion.div
                  key="password-entry"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="glass-card glass-card-elevated login-card"
                >
                  <LoginForm onSuccess={handleLoginSuccess} />
                </motion.div>
              )}

              {loginState === 'TOTP_VERIFICATION' && (
                <motion.div
                  key="totp-verification"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="glass-card glass-card-elevated login-card"
                >
                  <TotpVerificationForm
                    employeeNumber={employeeNumber}
                    onBack={handleBackToPassword}
                    onSuccess={handleTotpVerified}
                    onUseBackupCode={handleBackupCodeSwitch}
                  />
                </motion.div>
              )}

              {loginState === 'BACKUP_CODE_ENTRY' && (
                <motion.div
                  key="backup-code-entry"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="glass-card glass-card-elevated login-card"
                >
                  <BackupCodeForm
                    employeeNumber={employeeNumber}
                    onSuccess={completeAuthentication}
                    onBack={handleBackToTotp}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  );
};
