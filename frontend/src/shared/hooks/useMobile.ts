import { useState, useEffect, useCallback } from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

/**
 * Hook to detect mobile/tablet/desktop viewport
 * Uses window.matchMedia for efficient resize detection
 */
export function useMobile(): MobileState {
  const getState = useCallback((): MobileState => {
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
  }, []);

  const [state, setState] = useState<MobileState>(getState);

  useEffect(() => {
    const handleResize = () => {
      setState(getState());
    };

    // Use matchMedia for more efficient detection
    const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const tabletQuery = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`);

    const handleMediaChange = () => {
      setState(getState());
    };

    // Modern browsers support addEventListener
    mobileQuery.addEventListener('change', handleMediaChange);
    tabletQuery.addEventListener('change', handleMediaChange);
    window.addEventListener('resize', handleResize);

    // Set initial state
    setState(getState());

    return () => {
      mobileQuery.removeEventListener('change', handleMediaChange);
      tabletQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [getState]);

  return state;
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
