import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createTestStore, createAuthenticatedState } from '../../test/test-utils';

// vi.hoisted ensures these refs are captured before vi.mock hoisting
const { mockRefreshTokenFn, mockGetTokenExpiresAt, mockSetTokenExpiration } = vi.hoisted(() => ({
  mockRefreshTokenFn: vi.fn(),
  mockGetTokenExpiresAt: vi.fn<() => number | null>(),
  mockSetTokenExpiration: vi.fn(),
}));

vi.mock('@features/auth/services/authApi', () => ({
  useRefreshTokenMutation: () => [mockRefreshTokenFn, {}],
}));

vi.mock('@services/baseApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/baseApi')>();
  return {
    ...actual,
    getTokenExpiresAt: mockGetTokenExpiresAt,
    setTokenExpiration: mockSetTokenExpiration,
  };
});

// Import AFTER vi.mock calls
import { useTokenAutoRefresh } from './useTokenAutoRefresh';

const NOW = 1_700_000_000_000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 60_000;

const makeWrapper = (authenticated = true) => {
  const store = createTestStore(
    authenticated
      ? createAuthenticatedState()
      : { auth: { isAuthenticated: false, user: null, token: null } }
  );
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
};

/**
 * Configure localStorage so userIsActive() returns the desired value.
 * The hook reads `last_user_activity` and `session_timeout_ms`.
 */
function setUserActive(active: boolean) {
  const lastActivity = active ? NOW - 1_000 : NOW - SESSION_TIMEOUT_MS - 1_000;
  vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
    if (key === 'session_timeout_ms') return String(SESSION_TIMEOUT_MS);
    if (key === 'last_user_activity') return String(lastActivity);
    return null;
  });
}

describe('useTokenAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mockRefreshTokenFn.mockReset();
    mockGetTokenExpiresAt.mockReset();
    mockSetTokenExpiration.mockReset();

    // Default: refresh resolves successfully with a fresh expiry
    mockRefreshTokenFn.mockReturnValue({
      unwrap: () => Promise.resolve({ expires_in: 1800 }),
    });

    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not refresh when the user is not authenticated', async () => {
    setUserActive(true);
    mockGetTokenExpiresAt.mockReturnValue(NOW + 60_000); // 1 min — would trigger if authenticated

    renderHook(() => useTokenAutoRefresh(), { wrapper: makeWrapper(false) });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(mockRefreshTokenFn).not.toHaveBeenCalled();
  });

  it('does not refresh when the token expiry is unknown (null)', async () => {
    setUserActive(true);
    mockGetTokenExpiresAt.mockReturnValue(null);

    renderHook(() => useTokenAutoRefresh(), { wrapper: makeWrapper() });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(mockRefreshTokenFn).not.toHaveBeenCalled();
  });

  it('does not refresh when the token has plenty of time left', async () => {
    setUserActive(true);
    mockGetTokenExpiresAt.mockReturnValue(NOW + 20 * 60 * 1000); // 20 min away

    renderHook(() => useTokenAutoRefresh(), { wrapper: makeWrapper() });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(mockRefreshTokenFn).not.toHaveBeenCalled();
  });

  it('does not refresh when user has been idle longer than the session timeout', async () => {
    setUserActive(false);
    mockGetTokenExpiresAt.mockReturnValue(NOW + 60_000); // 1 min — within threshold

    renderHook(() => useTokenAutoRefresh(), { wrapper: makeWrapper() });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(mockRefreshTokenFn).not.toHaveBeenCalled();
  });

  it('refreshes the token when within the 5-minute threshold and user is active', async () => {
    setUserActive(true);
    mockGetTokenExpiresAt.mockReturnValue(NOW + REFRESH_THRESHOLD_MS - 1_000);

    renderHook(() => useTokenAutoRefresh(), { wrapper: makeWrapper() });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(mockRefreshTokenFn).toHaveBeenCalledTimes(1);
  });

  it('updates token expiration after a successful refresh', async () => {
    setUserActive(true);
    mockGetTokenExpiresAt.mockReturnValue(NOW + 60_000);

    renderHook(() => useTokenAutoRefresh(), { wrapper: makeWrapper() });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(mockSetTokenExpiration).toHaveBeenCalledWith(1800);
  });

  it('runs an immediate check on mount, then again on each interval tick', async () => {
    setUserActive(true);
    mockGetTokenExpiresAt.mockReturnValue(NOW + 60_000);

    renderHook(() => useTokenAutoRefresh(), { wrapper: makeWrapper() });

    // Immediate check
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mockRefreshTokenFn).toHaveBeenCalledTimes(1);

    // Advance one interval — the previous refresh in-flight flag has been
    // cleared because the promise already resolved, so a fresh tick fires.
    mockGetTokenExpiresAt.mockReturnValue(NOW + CHECK_INTERVAL_MS + 60_000);
    vi.setSystemTime(NOW + CHECK_INTERVAL_MS);
    await act(async () => { await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS); });

    expect(mockRefreshTokenFn).toHaveBeenCalledTimes(2);
  });

  it('does not start a second refresh while one is already in flight', async () => {
    setUserActive(true);
    mockGetTokenExpiresAt.mockReturnValue(NOW + 60_000);

    // Hold the refresh open so the in-flight guard is active when the
    // interval ticks again.
    let resolveRefresh: (value: { expires_in: number }) => void = () => {};
    mockRefreshTokenFn.mockReturnValue({
      unwrap: () =>
        new Promise<{ expires_in: number }>((resolve) => {
          resolveRefresh = resolve;
        }),
    });

    renderHook(() => useTokenAutoRefresh(), { wrapper: makeWrapper() });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mockRefreshTokenFn).toHaveBeenCalledTimes(1);

    // Advance several intervals while the first refresh is still pending
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 3);
    });

    expect(mockRefreshTokenFn).toHaveBeenCalledTimes(1);

    // Resolve the in-flight refresh so the test cleans up cleanly
    await act(async () => {
      resolveRefresh({ expires_in: 1800 });
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  it('does not crash when the refresh request rejects', async () => {
    setUserActive(true);
    mockGetTokenExpiresAt.mockReturnValue(NOW + 60_000);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockRefreshTokenFn.mockReturnValue({
      unwrap: () => Promise.reject(new Error('network error')),
    });

    renderHook(() => useTokenAutoRefresh(), { wrapper: makeWrapper() });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(mockRefreshTokenFn).toHaveBeenCalledTimes(1);
    expect(mockSetTokenExpiration).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();

    // After failure, the in-flight guard must be cleared so the next tick retries
    mockGetTokenExpiresAt.mockReturnValue(NOW + 60_000);
    await act(async () => { await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS); });

    expect(mockRefreshTokenFn).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });

  it('clears the polling interval on unmount', async () => {
    setUserActive(true);
    mockGetTokenExpiresAt.mockReturnValue(NOW + 20 * 60 * 1000); // far away — no refresh

    const { unmount } = renderHook(() => useTokenAutoRefresh(), {
      wrapper: makeWrapper(),
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    unmount();

    // Move the token into the refresh window AFTER unmount; no refresh should happen.
    mockGetTokenExpiresAt.mockReturnValue(NOW + 60_000);
    await act(async () => { await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 5); });

    expect(mockRefreshTokenFn).not.toHaveBeenCalled();
  });
});
