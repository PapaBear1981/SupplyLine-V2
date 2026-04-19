import { useState } from 'react';
import { Button, Checkbox, Toast, Input } from 'antd-mobile';
import { KeyOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useVerifyBackupCodeMutation } from '../../services/authApi';
import type { BackupCodeVerifyResponse } from '../../types';
import { MobileAuthShell } from './MobileAuthShell';
import './MobileTotpVerification.css';

interface MobileBackupCodeFormProps {
  employeeNumber: string;
  onSuccess: (response: BackupCodeVerifyResponse) => void;
  onBack: () => void;
}

/**
 * Mobile version of the 8-character backup code entry flow that lets
 * users who lost their authenticator device fall back on a previously
 * printed recovery code.
 */
export const MobileBackupCodeForm = ({
  employeeNumber,
  onSuccess,
  onBack,
}: MobileBackupCodeFormProps) => {
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [verifyBackupCode, { isLoading }] = useVerifyBackupCodeMutation();

  const handleVerify = async () => {
    if (code.length !== 8) {
      Toast.show({ icon: 'fail', content: 'Backup codes are 8 characters' });
      return;
    }

    try {
      const result = await verifyBackupCode({
        employee_number: employeeNumber,
        code: code.trim().toUpperCase(),
        trust_device: trustDevice,
      }).unwrap();

      const codesRemaining = result.codes_remaining ?? 0;
      if (codesRemaining === 0) {
        Toast.show({
          icon: 'success',
          content: 'Signed in. All backup codes used — generate new ones in Profile.',
          duration: 3000,
        });
      } else if (codesRemaining <= 3) {
        Toast.show({
          icon: 'success',
          content: `Signed in. ${codesRemaining} backup codes remaining.`,
          duration: 3000,
        });
      }
      onSuccess(result);
    } catch (error: unknown) {
      const apiError = error as { data?: { error?: string } };
      Toast.show({
        icon: 'fail',
        content: apiError?.data?.error || 'Invalid backup code',
      });
    }
  };

  return (
    <MobileAuthShell>
      <div className="mobile-totp-verification">
        <div className="mobile-totp-icon">
          <KeyOutlined />
        </div>
        <h2 className="mobile-totp-title">Use Backup Code</h2>
        <p className="mobile-totp-subtitle">
          Enter one of your 8-character backup codes. Each code can only be used once.
        </p>

        <div className="mobile-totp-input-wrapper">
          <Input
            className="mobile-totp-input"
            placeholder="ABC12345"
            value={code}
            onChange={(value) => {
              setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
            }}
            maxLength={8}
          />
        </div>

        <div className="mobile-totp-trust-device">
          <Checkbox
            checked={trustDevice}
            onChange={(value) => setTrustDevice(value)}
          >
            Trust this device for 30 days
          </Checkbox>
        </div>

        <Button
          block
          color="primary"
          size="large"
          loading={isLoading}
          disabled={code.length !== 8}
          onClick={handleVerify}
        >
          Verify Backup Code
        </Button>

        <Button
          block
          fill="none"
          size="small"
          onClick={onBack}
          className="mobile-totp-back"
        >
          <ArrowLeftOutlined /> Back to 2FA
        </Button>
      </div>
    </MobileAuthShell>
  );
};
