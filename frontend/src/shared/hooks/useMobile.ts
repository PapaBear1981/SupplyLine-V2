import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

function getSnapshot(): MobileState {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      width: 1920,
      height: 1080,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    isMobile: width < MOBILE_BREAKPOINT,
    isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
    isDesktop: width >= TABLET_BREAKPOINT,
    width,
    height,
  };
}

function getServerSnapshot(): MobileState {
  return {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1920,
    height: 1080,
  };
}

function subscribe(callback: () => void): () => void {
  const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const tabletQuery = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`);

  mobileQuery.addEventListener('change', callback);
  tabletQuery.addEventListener('change', callback);
  window.addEventListener('resize', callback);

  return () => {
    mobileQuery.removeEventListener('change', callback);
    tabletQuery.removeEventListener('change', callback);
    window.removeEventListener('resize', callback);
  };
}

/**
 * Hook to detect mobile/tablet/desktop viewport
 * Uses useSyncExternalStore for efficient resize detection
 */
export function useMobile(): MobileState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Simple boolean check for mobile viewport
 */
export function useIsMobile(): boolean {
  const { isMobile } = useMobile();
  return isMobile;
}

/**
 * Check if touch device (mobile or tablet)
 */
export function useIsTouchDevice(): boolean {
  const { isMobile, isTablet } = useMobile();
  return isMobile || isTablet;
}

export { MOBILE_BREAKPOINT, TABLET_BREAKPOINT };
