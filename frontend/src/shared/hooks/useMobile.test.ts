import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMobile, useIsMobile, useIsTouchDevice, MOBILE_BREAKPOINT, TABLET_BREAKPOINT } from './useMobile';

describe('useMobile', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: originalInnerHeight });
  });

  describe('useMobile hook', () => {
    it('should detect desktop viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });

      const { result } = renderHook(() => useMobile());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
    });

    it('should detect mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

      const { result } = renderHook(() => useMobile());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should detect tablet viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });

      const { result } = renderHook(() => useMobile());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should update on window resize', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });

      const { result } = renderHook(() => useMobile());

      expect(result.current.isDesktop).toBe(true);

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current.isMobile).toBe(true);
    });

    it('should return correct width and height', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

      const { result } = renderHook(() => useMobile());

      expect(result.current.width).toBe(1024);
      expect(result.current.height).toBe(768);
    });
  });

  describe('useIsMobile hook', () => {
    it('should return true for mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it('should return false for desktop viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });
  });

  describe('useIsTouchDevice hook', () => {
    it('should return true for mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

      const { result } = renderHook(() => useIsTouchDevice());

      expect(result.current).toBe(true);
    });

    it('should return true for tablet', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });

      const { result } = renderHook(() => useIsTouchDevice());

      expect(result.current).toBe(true);
    });

    it('should return false for desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });

      const { result } = renderHook(() => useIsTouchDevice());

      expect(result.current).toBe(false);
    });
  });

  describe('breakpoint constants', () => {
    it('should have correct mobile breakpoint', () => {
      expect(MOBILE_BREAKPOINT).toBe(768);
    });

    it('should have correct tablet breakpoint', () => {
      expect(TABLET_BREAKPOINT).toBe(1024);
    });
  });
});
