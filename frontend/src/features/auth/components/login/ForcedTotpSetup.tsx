import { useState } from 'react';
import { Steps, Card, Typography, Alert, Space, message } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@app/hooks';
import { setCredentials } from '../../slices/authSlice';
import {
  useSetupTotpMutation,
  useVerifyTotpSetupMutation,
  useGenerateBackupCodesMutation,
} from '../../services/authApi';
import { BackupCodesDisplay } from '../BackupCodesDisplay';
import { socketService } from '@services/socket';
import { ROUTES } from '@shared/constants/routes';
import type { LoginResponse } from '../../types';
import { pageVariants, modalVariants } from '../../styles/animations';
import './ForcedTotpSetup.css';

const { Title, Text, Paragraph } = Typography;

type SetupStep = 'intro' | 'scan' | 'verify' | 'backup' | 'complete';

export const ForcedTotpSetup = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [currentStep, setCurrentStep] = useState<SetupStep>('intro');
  const [qrCode, setQrCode] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesGeneratedAt, setBackupCodesGeneratedAt] = useState<string>('');
  const [authResponse, setAuthResponse] = useState<LoginResponse | null>(null);

  const [setupTotp] = useSetupTotpMutation();
  const [verifyTotpSetup] = useVerifyTotpSetupMutation();
  const [generateBackupCodes] = useGenerateBackupCodesMutation();

  const handleStartSetup = async () => {
    try {
      const result = await setupTotp().unwrap();
      setQrCode(result.qr_code);
      setCurrentStep('scan');
    } catch (error: any) {
      message.error(error?.data?.error || 'Failed to generate QR code');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      message.error('Please enter a valid 6-digit code');
      return;
    }

    try {
      // Verify TOTP and receive authentication tokens
      const verifyResult = await verifyTotpSetup({ code: verificationCode }).unwrap();
      setAuthResponse(verifyResult as LoginResponse);
      message.success('Two-factor authentication enabled!');

      // Generate backup codes
      const codesResult = await generateBackupCodes().unwrap();
      setBackupCodes(codesResult.backup_codes);
      setBackupCodesGeneratedAt(codesResult.generated_at);
      setCurrentStep('backup');
    } catch (error: any) {
      message.error(error?.data?.error || 'Invalid verification code');
    }
  };

  const handleBackupCodesConfirmed = () => {
    if (!authResponse) {
      message.error('Authentication error. Please try again.');
      return;
    }

    // Complete authentication with full credentials
    dispatch(
      setCredentials({
        user: authResponse.user,
        token: authResponse.access_token,
        expiresIn: authResponse.expires_in,
      })
    );

    // Establish WebSocket connection
    try {
      socketService.connect(authResponse.access_token);
    } catch (socketError) {
      console.warn('WebSocket connection failed:', socketError);
    }

    message.success('Setup complete! Welcome to SupplyLine.');
    navigate(ROUTES.DASHBOARD);
  };

  const stepItems = [
    { title: 'Introduction' },
    { title: 'Scan QR Code' },
    { title: 'Verify Code' },
    { title: 'Backup Codes' },
  ];

  const getCurrentStepIndex = () => {
    const stepMap: Record<SetupStep, number> = { intro: 0, scan: 1, verify: 2, backup: 3, complete: 4 };
    return stepMap[currentStep] || 0;
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="forced-totp-setup"
    >
      <Card className="glass-card-elevated forced-totp-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="setup-header">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="setup-icon"
            >
              <SafetyCertificateOutlined />
            </motion.div>
            <Title level={2} style={{ marginTop: 16, marginBottom: 8 }}>
              Secure Your Account
            </Title>
            <Text type="secondary">
              Two-factor authentication is required for all users
            </Text>
          </div>

          <Steps current={getCurrentStepIndex()} items={stepItems} size="small" />

          <AnimatePresence mode="wait">
            {currentStep === 'intro' && (
              <motion.div
                key="intro"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Alert
                  message="Enhanced Security Required"
                  description={
                    <div>
                      <Paragraph>
                        To protect your account and company data, two-factor authentication (2FA)
                        is now mandatory for all users.
                      </Paragraph>
                      <Paragraph>
                        <strong>What you'll need:</strong>
                      </Paragraph>
                      <ul>
                        <li>A smartphone or tablet</li>
                        <li>An authenticator app (Authy, Google Authenticator, Microsoft Authenticator, etc.)</li>
                      </ul>
                      <Paragraph style={{ marginBottom: 0 }}>
                        <strong>This process takes about 2 minutes.</strong>
                      </Paragraph>
                    </div>
                  }
                  type="info"
                  showIcon
                />

                <button
                  className="glass-button setup-button"
                  onClick={handleStartSetup}
                >
                  Get Started
                </button>
              </motion.div>
            )}

            {currentStep === 'scan' && (
              <motion.div
                key="scan"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Alert
                  message="Step 1: Scan QR Code"
                  description="Open your authenticator app and scan this QR code"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <div className="qr-code-container">
                  {qrCode && (
                    <motion.img
                      src={qrCode}
                      alt="TOTP QR Code"
                      className="qr-code"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                    />
                  )}
                </div>

                <Alert
                  message="Can't scan the code?"
                  description="If you're having trouble scanning, you can manually enter the code in your authenticator app."
                  type="warning"
                  showIcon
                  style={{ marginTop: 16 }}
                />

                <button
                  className="glass-button setup-button"
                  onClick={() => setCurrentStep('verify')}
                >
                  Next: Verify Code
                </button>
              </motion.div>
            )}

            {currentStep === 'verify' && (
              <motion.div
                key="verify"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Alert
                  message="Step 2: Verify Your Code"
                  description="Enter the 6-digit code from your authenticator app"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <div className="verification-input-container">
                  <input
                    type="text"
                    className="glass-input verification-input"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && verificationCode.length === 6) {
                        handleVerifyCode();
                      }
                    }}
                    autoFocus
                  />
                </div>

                <Space direction="horizontal" style={{ width: '100%' }}>
                  <button
                    className="glass-button-secondary"
                    onClick={() => setCurrentStep('scan')}
                  >
                    Back
                  </button>
                  <button
                    className="glass-button setup-button"
                    onClick={handleVerifyCode}
                    disabled={verificationCode.length !== 6}
                  >
                    Verify & Continue
                  </button>
                </Space>
              </motion.div>
            )}

            {currentStep === 'backup' && (
              <motion.div
                key="backup"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Alert
                  message="Step 3: Save Your Backup Codes"
                  description="These codes will allow you to access your account if you lose your phone"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <BackupCodesDisplay
                  codes={backupCodes}
                  generatedAt={backupCodesGeneratedAt}
                  onConfirm={handleBackupCodesConfirmed}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Space>
      </Card>
    </motion.div>
  );
};
