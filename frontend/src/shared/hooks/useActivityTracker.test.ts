import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createTestStore, createAuthenticatedState } from '../../test/test-utils';
import { useActivityTracker } from './useActivityTracker';

const makeWrapper = () => {
  const store = createTestStore(createAuthenticatedState());
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  };
};

describe('useActivityTracker', () => {
  const NOW = 1_000_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(localStorage.setItem).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('writes last_user_activity to localStorage on first event', () => {
    renderHook(() => useActivityTracker(), { wrapper: makeWrapper() });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });

    expect(localStorage.setItem).toHaveBeenCalledWith('last_user_activity', String(NOW));
  });

  it('does not write again within the 30-second throttle window', () => {
    renderHook(() => useActivityTracker(), { wrapper: makeWrapper() });

    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });
    vi.mocked(localStorage.setItem).mockClear();

    vi.advanceTimersByTime(15_000);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });

    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('writes again after the 30-second throttle window expires', () => {
    renderHook(() => useActivityTracker(), { wrapper: makeWrapper() });

    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });
    vi.mocked(localStorage.setItem).mockClear();

    vi.advanceTimersByTime(31_000);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'last_user_activity',
      String(NOW + 31_000)
    );
  });

  it('does not write via deferred setTimeout on wake-from-sleep', () => {
    // Regression test for the bug: old code scheduled a setTimeout that fired
    // with Date.now() = wake time, resetting the inactivity clock and
    // preventing auto-logout after an overnight session.
    renderHook(() => useActivityTracker(), { wrapper: makeWrapper() });

    // First event: immediately written (throttle window satisfied)
    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });
    vi.mocked(localStorage.setItem).mockClear();

    // Second event within the throttle window: NOT written immediately
    vi.advanceTimersByTime(10_000);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });

    // Simulate the computer sleeping overnight and waking up
    vi.advanceTimersByTime(8 * 60 * 60 * 1_000);

    // No deferred write should have fired — storing the wake time as "last
    // activity" would have reset the inactivity clock and blocked auto-logout
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it.each(['mousemove', 'keydown', 'click', 'scroll', 'touchstart'])(
    'records activity for %s event',
    (eventType) => {
      renderHook(() => useActivityTracker(), { wrapper: makeWrapper() });

      act(() => { window.dispatchEvent(new Event(eventType)); });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'last_user_activity',
        expect.any(String)
      );
    }
  );

  it('does not track events when unauthenticated', () => {
    const store = createTestStore({
      auth: { isAuthenticated: false, user: null, token: null },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store }, children);

    renderHook(() => useActivityTracker(), { wrapper: Wrapper });
    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });

    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('removes all event listeners on unmount', () => {
    const spy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useActivityTracker(), { wrapper: makeWrapper() });

    unmount();

    for (const event of ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']) {
      expect(spy).toHaveBeenCalledWith(event, expect.any(Function));
    }
  });
});
