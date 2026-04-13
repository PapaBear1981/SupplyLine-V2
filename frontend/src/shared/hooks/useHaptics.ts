import { useCallback } from 'react';

/**
 * Lightweight haptic feedback hook using the Vibration API.
 *
 * Pattern convention (short, snappy, non-disruptive):
 *   selection:   single 10ms tap — navigation, list taps, chip selection
 *   success:     [30]             — completed action (checkout, save, submit)
 *   warning:     [20, 40, 20]     — caution / non-blocking warning
 *   error:       [40, 60, 40]     — validation errors, failed actions
 *   heavy:       [50]             — important confirmation (delete, lock)
 *
 * Silently no-ops on devices without navigator.vibrate support
 * (desktops, iOS Safari, users with reduced-motion enabled).
 */
export type HapticPattern = 'selection' | 'success' | 'warning' | 'error' | 'heavy';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  selection: 10,
  success: [30],
  warning: [20, 40, 20],
  error: [40, 60, 40],
  heavy: [50],
};

function canVibrate(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  if (!('vibrate' in navigator)) return false;

  // Respect reduced-motion preference
  try {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return false;
  } catch {
    // matchMedia unavailable — continue
  }

  return true;
}

export function useHaptics() {
  const trigger = useCallback((pattern: HapticPattern = 'selection') => {
    if (!canVibrate()) return;
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch {
      // Ignore vibration errors
    }
  }, []);

  return { trigger };
}
