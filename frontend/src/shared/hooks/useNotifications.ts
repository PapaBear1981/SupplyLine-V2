import { useCallback, useState, useEffect } from 'react';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface ShowNotificationInput {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
}

/**
 * Lightweight wrapper around the Notification API for mobile and
 * desktop browsers. Intentionally scoped to local (in-tab) notifications
 * — full Web Push with service workers is on hold until the PWA work
 * lands, but this hook already gives us:
 *
 *   - permission prompt flow (requestPermission + local state)
 *   - helper to display a notification
 *   - graceful "unsupported" fallback on browsers without Notification
 *
 * When the PWA ships, a new hook can layer ServiceWorkerRegistration
 * .pushManager.subscribe() on top of this for server-driven pushes.
 */
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  // Keep the local state in sync if the browser updates permission
  // (e.g. user toggles it from the site-info dropdown). There's no
  // permissions.query for Notification on all browsers, so we just
  // re-read on window focus.
  useEffect(() => {
    if (permission === 'unsupported') return;
    const onFocus = () => {
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [permission]);

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (permission === 'unsupported') return 'unsupported';
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      return next;
    } catch {
      // Keep internal state in sync with what the caller receives so
      // hook.isDenied / the show() guard aren't left pointing at stale
      // 'default' after an exception.
      setPermission('denied');
      return 'denied';
    }
  }, [permission]);

  const show = useCallback(
    (input: ShowNotificationInput) => {
      if (permission !== 'granted') return null;
      try {
        const notification = new Notification(input.title, {
          body: input.body,
          icon: input.icon,
          tag: input.tag,
          requireInteraction: input.requireInteraction,
        });
        if (input.onClick) {
          notification.onclick = () => {
            window.focus();
            input.onClick?.();
            notification.close();
          };
        }
        return notification;
      } catch {
        return null;
      }
    },
    [permission]
  );

  return {
    permission,
    isSupported: permission !== 'unsupported',
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    requestPermission,
    show,
  };
}
