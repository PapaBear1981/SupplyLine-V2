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
  const throttleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Only track activity if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    // Throttled activity handler - updates at most once per 30 seconds
    // This prevents excessive updates while still tracking user activity
    const handleActivity = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastActivityRef.current;

      // Only update if more than 30 seconds have passed
      if (timeSinceLastUpdate > 30000) {
        lastActivityRef.current = now;

        // Store last activity in localStorage for persistence across page reloads
        try {
          localStorage.setItem('last_user_activity', now.toString());
        } catch {
          // localStorage may be unavailable
        }

        // Clear any existing throttle timer
        if (throttleTimerRef.current !== null) {
          window.clearTimeout(throttleTimerRef.current);
        }
      } else if (throttleTimerRef.current === null) {
        // Schedule an update for later if we're within the throttle window
        throttleTimerRef.current = window.setTimeout(() => {
          lastActivityRef.current = Date.now();
          try {
            localStorage.setItem('last_user_activity', Date.now().toString());
          } catch {
            // localStorage may be unavailable
          }
          throttleTimerRef.current = null;
        }, 30000 - timeSinceLastUpdate);
      }
    };

    // List of events that indicate user activity
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Attach event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup function
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      if (throttleTimerRef.current !== null) {
        window.clearTimeout(throttleTimerRef.current);
      }
    };
  }, [isAuthenticated]);

  return {
    getLastActivity: () => lastActivityRef.current,
  };
};
