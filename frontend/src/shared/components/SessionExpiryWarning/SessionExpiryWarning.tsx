import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Typography, Progress } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useAppSelector } from '@app/hooks';
import { useRefreshTokenMutation } from '@features/auth/services/authApi';

const { Text, Title } = Typography;

// Warning shows 3 minutes before expiration
const WARNING_THRESHOLD_MS = 3 * 60 * 1000;

// Auto-logout happens 30 seconds before token expires
const AUTO_LOGOUT_THRESHOLD_MS = 30 * 1000;

export const SessionExpiryWarning = () => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [refreshToken] = useRefreshTokenMutation();

  // Get token expiration from module-level variable in baseApi
  const getTokenExpiration = useCallback(() => {
    // Access the tokenExpiresAt from localStorage as backup
    const storedExpiry = localStorage.getItem('token_expires_at');
    return storedExpiry ? parseInt(storedExpiry, 10) : null;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false);
      return;
    }

    const checkExpiry = () => {
      const expiresAt = getTokenExpiration();
      if (!expiresAt) return;

      const now = Date.now();
      const remaining = expiresAt - now;

      // Show warning if token expires in less than WARNING_THRESHOLD_MS
      if (remaining <= WARNING_THRESHOLD_MS && remaining > AUTO_LOGOUT_THRESHOLD_MS) {
        setShowWarning(true);
        setTimeRemaining(remaining);
      } else if (remaining <= AUTO_LOGOUT_THRESHOLD_MS) {
        // Token is about to expire - let the auto-refresh handle it
        setShowWarning(false);
      } else {
        setShowWarning(false);
      }
    };

    // Check every 10 seconds
    const interval = setInterval(checkExpiry, 10000);

    // Initial check
    checkExpiry();

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, getTokenExpiration]);

  // Update countdown every second when warning is shown
  useEffect(() => {
    if (!showWarning) return;

    const interval = setInterval(() => {
      const expiresAt = getTokenExpiration();
      if (!expiresAt) return;

      const now = Date.now();
      const remaining = expiresAt - now;

      setTimeRemaining(remaining);

      // Hide warning if time is up or user refreshed
      if (remaining <= AUTO_LOGOUT_THRESHOLD_MS || remaining > WARNING_THRESHOLD_MS) {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [showWarning, getTokenExpiration]);

  const handleStayLoggedIn = async () => {
    try {
      // Refresh the token to extend the session
      await refreshToken().unwrap();
      setShowWarning(false);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // The baseQueryWithAuth will handle the logout
    }
  };

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercent = () => {
    const totalWarningTime = WARNING_THRESHOLD_MS - AUTO_LOGOUT_THRESHOLD_MS;
    const elapsed = WARNING_THRESHOLD_MS - timeRemaining;
    return Math.min(100, Math.max(0, (elapsed / totalWarningTime) * 100));
  };

  return (
    <Modal
      open={showWarning}
      closable={false}
      footer={[
        <Button key="stay" type="primary" onClick={handleStayLoggedIn} size="large">
          Stay Logged In
        </Button>,
      ]}
      centered
      width={450}
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <ExclamationCircleOutlined
          style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }}
        />
        <Title level={4} style={{ marginBottom: 8 }}>
          Session Expiring Soon
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Your session will expire due to inactivity. Click below to stay logged in.
        </Text>

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ fontSize: 32, color: '#1890ff' }}>
            {formatTimeRemaining(timeRemaining)}
          </Text>
          <Progress
            percent={getProgressPercent()}
            showInfo={false}
            strokeColor="#faad14"
            style={{ marginTop: 12 }}
          />
        </div>

        <Text type="secondary" style={{ fontSize: 12 }}>
          Your work is saved. Click "Stay Logged In" to continue your session.
        </Text>
      </div>
    </Modal>
  );
};
