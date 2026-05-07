import { useEffect, useRef } from 'react';
import { useAppSelector } from '@app/hooks';
import { useRefreshTokenMutation } from '@features/auth/services/authApi';
import { getTokenExpiresAt, setTokenExpiration } from '@services/baseApi';

const CHECK_INTERVAL_MS = 60_000;
// Refresh when the access token is within this window of expiring.
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const FALLBACK_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function getSessionTimeoutMs(): number {
  const cached = localStorage.getItem('session_timeout_ms');
  return cached ? parseInt(cached, 10) : FALLBACK_SESSION_TIMEOUT_MS;
}

function userIsActive(): boolean {
  const lastActivity = parseInt(localStorage.getItem('last_user_activity') || '0', 10);
  if (!lastActivity) return false;
  return Date.now() - lastActivity < getSessionTimeoutMs();
}

/**
 * Proactively refresh the JWT before it expires.
 *
 * The interceptor in baseApi only refreshes piggy-backed on API calls. A user
 * reading a page without triggering requests would otherwise have their token
 * expire silently and get bounced to the login screen on the next click.
 */
export const useTokenAutoRefresh = () => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [refreshToken] = useRefreshTokenMutation();
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const tick = async () => {
      if (inFlightRef.current) return;

      const expiresAt = getTokenExpiresAt();
      if (!expiresAt) return;

      const msUntilExpiry = expiresAt - Date.now();
      if (msUntilExpiry > REFRESH_THRESHOLD_MS) return;
      if (!userIsActive()) return;

      inFlightRef.current = true;
      try {
        const result = await refreshToken().unwrap();
        if (result.expires_in) {
          setTokenExpiration(result.expires_in);
        }
      } catch (error) {
        console.warn('Proactive token refresh failed:', error);
      } finally {
        inFlightRef.current = false;
      }
    };

    void tick();
    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshToken]);
};
