import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import { render, createAuthenticatedState } from '../../../test/test-utils';
import { SessionExpiryWarning } from './SessionExpiryWarning';

// Ant Design keeps the Modal DOM node for its close animation even when
// open={false}, which breaks toBeInTheDocument assertions. Mock it to return
// null immediately so tests can assert on DOM presence cleanly.
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    Modal: ({
      open,
      children,
      footer,
    }: {
      open: boolean;
      children?: React.ReactNode;
      footer?: React.ReactNode;
    }) => {
      if (!open) return null;
      return (
        <div role="dialog" aria-modal="true">
          {children}
          {footer}
        </div>
      );
    },
  };
});

// vi.hoisted ensures these refs are captured before vi.mock hoisting
const { mockRefreshTokenFn } = vi.hoisted(() => ({
  mockRefreshTokenFn: vi.fn(),
}));

vi.mock('@features/auth/services/authApi', () => ({
  useRefreshTokenMutation: () => [mockRefreshTokenFn, {}],
}));

vi.mock('@services/socket', () => ({
  socketService: { disconnect: vi.fn() },
}));

describe('SessionExpiryWarning', () => {
  const NOW = 1_000_000_000_000;
  const TIMEOUT_MS = 1_800_000;     // 30 minutes (matches FALLBACK_TIMEOUT_MS)
  const WARNING_THRESHOLD_MS = 180_000; // 3 minutes (matches WARNING_THRESHOLD_MS)

  // Prime localStorage to yield a specific number of ms remaining in the session
  function setupTimeRemaining(msRemaining: number) {
    const lastActivity = NOW - (TIMEOUT_MS - msRemaining);
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'session_timeout_ms') return String(TIMEOUT_MS);
      if (key === 'last_user_activity') return String(lastActivity);
      return null;
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    // Default refreshToken mock: returns an unwrappable result
    mockRefreshTokenFn.mockReturnValue({
      unwrap: () => Promise.resolve({ expires_in: 1800 }),
    });

    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockClear();

    // Prevent jsdom from throwing on window.location.href assignment
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not show the warning when the session has plenty of time remaining', async () => {
    setupTimeRemaining(10 * 60 * 1000); // 10 minutes left

    render(<SessionExpiryWarning />, { preloadedState: createAuthenticatedState() });
    await act(async () => { vi.advanceTimersByTime(0); });

    expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
  });

  it('shows the warning when the session is within the 3-minute threshold', async () => {
    setupTimeRemaining(2 * 60 * 1000); // 2 minutes left

    render(<SessionExpiryWarning />, { preloadedState: createAuthenticatedState() });
    await act(async () => { vi.advanceTimersByTime(0); });

    expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
  });

  it('shows the warning after the 10-second inactivity check interval fires', async () => {
    setupTimeRemaining(WARNING_THRESHOLD_MS - 1); // just inside the threshold

    render(<SessionExpiryWarning />, { preloadedState: createAuthenticatedState() });

    // Advance past the 10-second polling interval
    await act(async () => { vi.advanceTimersByTime(10_000); });

    expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
  });

  it('regression: warning stays visible when mouse activity resets last_user_activity', async () => {
    // This is the exact scenario that was reported: the countdown dialog closed
    // the moment the user moved the mouse. The per-second countdown timer was
    // dismissing the warning whenever getMsUntilTimeout() jumped back above the
    // threshold, which happened as soon as useActivityTracker wrote a fresh
    // last_user_activity timestamp.
    setupTimeRemaining(2 * 60 * 1000); // 2 minutes → warning should show

    render(<SessionExpiryWarning />, { preloadedState: createAuthenticatedState() });
    await act(async () => { vi.advanceTimersByTime(0); });

    expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();

    // Simulate useActivityTracker writing a fresh timestamp (user moved the mouse)
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'session_timeout_ms') return String(TIMEOUT_MS);
      if (key === 'last_user_activity') return String(NOW); // reset to "now"
      return null;
    });

    // Tick the per-second countdown — the old code would have closed the modal here
    await act(async () => { vi.advanceTimersByTime(1_000); });

    // Warning must remain: user still needs to explicitly click "Stay Logged In"
    expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
  });

  it('dismisses the warning when "Stay Logged In" is clicked', async () => {
    setupTimeRemaining(2 * 60 * 1000);

    render(<SessionExpiryWarning />, { preloadedState: createAuthenticatedState() });
    await act(async () => { vi.advanceTimersByTime(0); });

    expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stay logged in/i }));
    });

    expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
  });

  it('calls the token refresh API when "Stay Logged In" is clicked', async () => {
    setupTimeRemaining(2 * 60 * 1000);

    render(<SessionExpiryWarning />, { preloadedState: createAuthenticatedState() });
    await act(async () => { vi.advanceTimersByTime(0); });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stay logged in/i }));
    });

    expect(mockRefreshTokenFn).toHaveBeenCalled();
  });

  it('resets the inactivity clock in localStorage when "Stay Logged In" is clicked', async () => {
    setupTimeRemaining(2 * 60 * 1000);

    render(<SessionExpiryWarning />, { preloadedState: createAuthenticatedState() });
    await act(async () => { vi.advanceTimersByTime(0); });

    vi.mocked(localStorage.setItem).mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stay logged in/i }));
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'last_user_activity',
      String(NOW)
    );
  });

  it('dispatches logout when the inactivity timer reaches zero', async () => {
    setupTimeRemaining(0); // already expired

    const { store } = render(
      <SessionExpiryWarning />,
      { preloadedState: createAuthenticatedState() }
    );

    // checkInactivity() runs immediately on mount; Redux dispatch is
    // synchronous so the state is already updated by the time act() settles.
    await act(async () => {});

    expect(store.getState().auth.isAuthenticated).toBe(false);
  });

  it('does not render the warning when the user is not authenticated', async () => {
    setupTimeRemaining(2 * 60 * 1000); // would trigger warning if authenticated

    render(<SessionExpiryWarning />, {
      preloadedState: { auth: { isAuthenticated: false, user: null, token: null } },
    });
    await act(async () => { vi.advanceTimersByTime(10_000); });

    expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
  });
});
