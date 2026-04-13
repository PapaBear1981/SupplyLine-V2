import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHaptics } from './useHaptics';

describe('useHaptics', () => {
  const originalVibrate = (navigator as unknown as { vibrate?: unknown }).vibrate;

  beforeEach(() => {
    (navigator as unknown as { vibrate: (pattern: number | number[]) => boolean }).vibrate =
      vi.fn(() => true);
  });

  afterEach(() => {
    if (originalVibrate === undefined) {
      delete (navigator as unknown as { vibrate?: unknown }).vibrate;
    } else {
      (navigator as unknown as { vibrate?: unknown }).vibrate = originalVibrate;
    }
    vi.restoreAllMocks();
  });

  it('invokes navigator.vibrate with the selection pattern by default', () => {
    const { result } = renderHook(() => useHaptics());

    act(() => result.current.trigger());

    expect(navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it.each([
    ['success', [30]],
    ['warning', [20, 40, 20]],
    ['error', [40, 60, 40]],
    ['heavy', [50]],
  ] as const)('dispatches %s pattern correctly', (pattern, expected) => {
    const { result } = renderHook(() => useHaptics());

    act(() => result.current.trigger(pattern));

    expect(navigator.vibrate).toHaveBeenCalledWith(expected);
  });

  it('silently no-ops when navigator.vibrate is unavailable', () => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;

    const { result } = renderHook(() => useHaptics());

    expect(() => result.current.trigger('success')).not.toThrow();
  });

  it('respects reduced-motion preference', () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('matchMedia', mockMatchMedia);

    const { result } = renderHook(() => useHaptics());
    act(() => result.current.trigger('success'));

    expect(navigator.vibrate).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
