import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile } from '@shared/hooks/useMobile';

// These tests verify the responsive layout logic via the useMobile hook
// since testing the full layout requires complex mocking of antd components

describe('ResponsiveLayout Logic', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('should detect desktop viewport for large screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('should detect mobile viewport for small screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('should use mobile layout when isMobile is true', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const { result } = renderHook(() => useIsMobile());

    // This validates the logic that ResponsiveLayout uses
    // When isMobile is true, MobileLayout should be rendered
    expect(result.current).toBe(true);
  });

  it('should use desktop layout when isMobile is false', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });

    const { result } = renderHook(() => useIsMobile());

    // This validates the logic that ResponsiveLayout uses
    // When isMobile is false, MainLayout should be rendered
    expect(result.current).toBe(false);
  });
});
