import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Typography, Progress } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { logout } from '@features/auth/slices/authSlice';
import { useRefreshTokenMutation } from '@features/auth/services/authApi';
import { setTokenExpiration } from '@services/baseApi';

const { Text, Title } = Typography;

// Show the warning this many ms before the inactivity timeout fires
const WARNING_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

const FALLBACK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Reads the admin-configured inactivity timeout, falling back to 30 min. */
function getSessionTimeoutMs(): number {
  const cached = localStorage.getItem('session_timeout_ms');
  return cached ? parseInt(cached, 10) : FALLBACK_TIMEOUT_MS;
}

/** Returns ms until the session times out due to inactivity, or null if no activity recorded. */
function getMsUntilTimeout(): number | null {
  const lastActivity = parseInt(localStorage.getItem('last_user_activity') || '0', 10);
  if (!lastActivity) return null;
  const elapsed = Date.now() - lastActivity;
  return Math.max(0, getSessionTimeoutMs() - elapsed);
}

export const SessionExpiryWarning = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [refreshToken] = useRefreshTokenMutation();

  const handleLogout = useCallback(() => {
    dispatch(logout());
    try {
      import('@services/socket').then(({ socketService }) => socketService.disconnect()).catch(() => {});
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [dispatch]);

  // Reset warning on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false);
    }
  }, [isAuthenticated]);

  // Main inactivity check — runs every 10 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkInactivity = () => {
      const msLeft = getMsUntilTimeout();

      if (msLeft === null) return; // no activity recorded yet

      if (msLeft <= 0) {
        // Inactivity timeout reached — log out
        setShowWarning(false);
        handleLogout();
      } else if (msLeft <= WARNING_THRESHOLD_MS) {
        // Approaching timeout — show warning
        setShowWarning(true);
        setTimeRemaining(msLeft);
      } else {
        setShowWarning(false);
      }
    };

    const interval = setInterval(checkInactivity, 10_000);
    checkInactivity(); // run immediately

    return () => clearInterval(interval);
  }, [isAuthenticated, handleLogout]);

  // Per-second countdown while warning is visible
  useEffect(() => {
    if (!showWarning) return;

    const interval = setInterval(() => {
      const msLeft = getMsUntilTimeout();

      if (msLeft === null || msLeft <= 0) {
        setShowWarning(false);
        handleLogout();
        return;
      }

      setTimeRemaining(msLeft);

      if (msLeft > WARNING_THRESHOLD_MS) {
        // User became active again (activity tracker updated localStorage)
        setShowWarning(false);
      }
    }, 1_000);

    return () => clearInterval(interval);
  }, [showWarning, handleLogout]);

  const handleStayLoggedIn = async () => {
    // Reset inactivity clock immediately
    localStorage.setItem('last_user_activity', Date.now().toString());
    setShowWarning(false);

    // Also refresh the JWT so the backend session is extended
    try {
      const result = await refreshToken().unwrap();
      if (result.expires_in) {
        setTokenExpiration(result.expires_in);
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }
  };

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1_000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercent = () => {
    const elapsed = WARNING_THRESHOLD_MS - timeRemaining;
    return Math.min(100, Math.max(0, (elapsed / WARNING_THRESHOLD_MS) * 100));
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
