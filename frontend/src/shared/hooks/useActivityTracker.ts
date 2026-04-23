import { useEffect, useRef } from 'react';
import { useAppSelector } from '@app/hooks';

/**
 * Hook to track user activity and prevent premature logout
 *
 * This hook monitors user interactions (mousemove, keydown, click, scroll)
 * and updates a timestamp. This helps distinguish between an idle user
 * and an active user who simply hasn't made API calls recently.
 */
export const useActivityTracker = () => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const lastActivityRef = useRef<number>(0);

  useEffect(() => {
    // Only track activity if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    // Throttled activity handler - updates at most once per 30 seconds.
    // Leading-edge only: write the timestamp of the actual event, never defer
    // with setTimeout. A deferred write would record the wake-from-sleep time
    // instead of the real activity time, resetting the inactivity clock.
    const handleActivity = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastActivityRef.current;

      if (timeSinceLastUpdate > 30000) {
        lastActivityRef.current = now;
        localStorage.setItem('last_user_activity', now.toString());
      }
    };

    // List of events that indicate user activity
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Attach event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated]);

  return {
    getLastActivity: () => lastActivityRef.current,
  };
};
