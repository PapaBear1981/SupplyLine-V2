import { useEffect, useRef, useState } from 'react';
import { Button, Toast, Input } from 'antd-mobile';
import { SafetyCertificateOutlined, ArrowLeftOutlined, KeyOutlined } from '@ant-design/icons';
import { useVerifyTotpMutation } from '../../services/authApi';
import type { LoginResponse } from '../../types';
import { MobileAuthShell } from './MobileAuthShell';
import './MobileTotpVerification.css';

interface MobileTotpVerificationProps {
  employeeNumber: string;
  onSuccess: (response: LoginResponse) => void;
  onBack: () => void;
  onUseBackupCode: () => void;
}

/**
 * Mobile version of the 2FA TOTP verification step. Renders inside the
 * shared MobileAuthShell so the mobile login, TOTP, and backup code
 * screens all share the same glass backdrop.
 */
export const MobileTotpVerification = ({
  employeeNumber,
  onSuccess,
  onBack,
  onUseBackupCode,
}: MobileTotpVerificationProps) => {
  const [code, setCode] = useState('');
  const [verifyTotp, { isLoading }] = useVerifyTotpMutation();

  // Ref-based timer so rapid re-renders don't pile up stale callbacks,
  // and so we can always cancel a pending auto-submit when the user
  // unmounts / navigates away / edits the code again.
  const autoSubmitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current !== null) {
        window.clearTimeout(autoSubmitTimerRef.current);
      }
    };
  }, []);

  // Accept the freshly-typed digits as an explicit argument so the
  // auto-submit path never reads a stale `code` from a previous render.
  const handleVerify = async (submittedCode: string = code) => {
    if (submittedCode.length !== 6) {
      Toast.show({ icon: 'fail', content: 'Please enter a 6-digit code' });
      return;
    }

    try {
      const result = await verifyTotp({
        employee_number: employeeNumber,
        code: submittedCode,
      }).unwrap();
      onSuccess(result as LoginResponse);
    } catch (error: unknown) {
      const apiError = error as { data?: { error?: string } };
      Toast.show({
        icon: 'fail',
        content: apiError?.data?.error || 'Invalid verification code',
      });
      setCode('');
    }
  };

  return (
    <MobileAuthShell>
      <div className="mobile-totp-verification">
        <div className="mobile-totp-icon">
          <SafetyCertificateOutlined />
        </div>
        <h2 className="mobile-totp-title">Two-Factor Authentication</h2>
        <p className="mobile-totp-subtitle">
          Enter the 6-digit code from your authenticator app.
        </p>

        <div className="mobile-totp-input-wrapper">
          <Input
            className="mobile-totp-input"
            type="tel"
            placeholder="000000"
            value={code}
            onChange={(value) => {
              const digits = value.replace(/\D/g, '').slice(0, 6);
              setCode(digits);
              if (digits.length === 6) {
                if (autoSubmitTimerRef.current !== null) {
                  window.clearTimeout(autoSubmitTimerRef.current);
                }
                // Tiny delay so the user sees the last digit before the
                // request. Fires handleVerify with the fresh digits so
                // we never submit a stale value.
                autoSubmitTimerRef.current = window.setTimeout(() => {
                  autoSubmitTimerRef.current = null;
                  void handleVerify(digits);
                }, 120);
              }
            }}
            maxLength={6}
          />
        </div>

        <Button
          block
          color="primary"
          size="large"
          loading={isLoading}
          disabled={code.length !== 6}
          onClick={() => {
            void handleVerify(code);
          }}
        >
          Verify Code
        </Button>

        <Button
          block
          fill="none"
          size="large"
          onClick={onUseBackupCode}
          className="mobile-totp-secondary-action"
        >
          <KeyOutlined /> Use backup code instead
        </Button>

        <Button
          block
          fill="none"
          size="small"
          onClick={onBack}
          className="mobile-totp-back"
        >
          <ArrowLeftOutlined /> Back to login
        </Button>
      </div>
    </MobileAuthShell>
  );
};
