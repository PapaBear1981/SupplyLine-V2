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

// Calculate state from current window dimensions
function calculateState(): MobileState {
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
  const isMobile = width < MOBILE_BREAKPOINT;
  const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
  const isDesktop = width >= TABLET_BREAKPOINT;

  return { isMobile, isTablet, isDesktop, width, height };
}

// Cache the current state to avoid creating new objects on every call
let cachedState: MobileState = calculateState();

function updateCachedState(): void {
  const newState = calculateState();

  // Only create new object if values actually changed
  if (
    cachedState.width !== newState.width ||
    cachedState.height !== newState.height ||
    cachedState.isMobile !== newState.isMobile ||
    cachedState.isTablet !== newState.isTablet ||
    cachedState.isDesktop !== newState.isDesktop
  ) {
    cachedState = newState;
  }
}

function getSnapshot(): MobileState {
  return cachedState;
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
  const handleChange = () => {
    updateCachedState();
    callback();
  };

  const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const tabletQuery = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`);

  mobileQuery.addEventListener('change', handleChange);
  tabletQuery.addEventListener('change', handleChange);
  window.addEventListener('resize', handleChange);

  return () => {
    mobileQuery.removeEventListener('change', handleChange);
    tabletQuery.removeEventListener('change', handleChange);
    window.removeEventListener('resize', handleChange);
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
