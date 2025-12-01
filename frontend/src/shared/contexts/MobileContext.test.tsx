import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MobileProvider, useMobileContext } from './MobileContext';

describe('MobileContext', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: originalInnerHeight });
  });

  describe('MobileProvider', () => {
    it('should provide mobile state to children', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <MobileProvider>{children}</MobileProvider>
      );

      const { result } = renderHook(() => useMobileContext(), { wrapper });

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should provide desktop state correctly', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <MobileProvider>{children}</MobileProvider>
      );

      const { result } = renderHook(() => useMobileContext(), { wrapper });

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isDesktop).toBe(true);
    });
  });

  describe('useMobileContext', () => {
    it('should throw error when used outside MobileProvider', () => {
      expect(() => {
        renderHook(() => useMobileContext());
      }).toThrow('useMobileContext must be used within a MobileProvider');
    });
  });
});
