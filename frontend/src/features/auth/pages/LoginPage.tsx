import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { message } from 'antd';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { setCredentials, setSetupToken } from '../slices/authSlice';
import { socketService } from '@services/socket';
import { ROUTES } from '@shared/constants/routes';
import { useIsMobile } from '@shared/hooks/useMobile';
import { MobileLoginForm } from '../components/mobile';
import { LoginForm } from '../components/login/LoginForm';
import { ForcedTotpSetup } from '../components/login/ForcedTotpSetup';
import { TotpVerificationForm } from '../components/TotpVerificationForm';
import { BackupCodeForm } from '../components/BackupCodeForm';
import { ThemeToggle } from '../components/shared/ThemeToggle';
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
    if (isAuthenticated && !isMobile && loginState === 'PASSWORD_ENTRY') {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [isAuthenticated, navigate, isMobile, loginState]);

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileLoginForm />;
  }

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

    message.success('Welcome back. Launch checklist complete.');
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

  return (
    <div className="login-page">
      <ThemeToggle />

      <div className="login-background">
        {/* Gradient background */}
        <div className="login-gradient" />
      </div>

      <div className="login-container">
        <AnimatePresence mode="wait">
          {loginState === 'PASSWORD_ENTRY' && (
            <motion.div
              key="password-entry"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="glass-card login-card"
            >
              <LoginForm onSuccess={handleLoginSuccess} />
            </motion.div>
          )}

          {loginState === 'TOTP_SETUP' && loginResponse && (
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
          )}

          {loginState === 'TOTP_VERIFICATION' && (
            <motion.div
              key="totp-verification"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="glass-card login-card"
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
              className="glass-card login-card"
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
    </div>
  );
};
