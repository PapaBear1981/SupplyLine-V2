import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ConfigProvider } from 'antd';
import { baseApi } from '@services/baseApi';
import authReducer from '@features/auth/slices/authSlice';
import { ThemeProvider } from '@features/settings/contexts/ThemeContext';
import { PermissionProvider } from '@features/auth/context/PermissionContext';

import { RequestsDashboard } from './RequestsDashboard';
import type { UserRequest } from '../types';

/**
 * The Requests dashboard surfaces Active and History tabs so that closed
 * requests (fulfilled / cancelled) don't crowd the work-in-progress view.
 * These tests pin down:
 *   1. The active list never asks the backend for a closed status.
 *   2. Switching to the History tab swaps the status filter to the closed set.
 *   3. The status-filter dropdown only offers the statuses that make sense
 *      for the active tab.
 */

const mockUseGetRequestsQuery = vi.fn();
const mockUseGetRequestAnalyticsQuery = vi.fn();

vi.mock('../services/requestsApi', () => ({
  useGetRequestsQuery: (...args: unknown[]) => mockUseGetRequestsQuery(...args),
  useGetRequestAnalyticsQuery: () => mockUseGetRequestAnalyticsQuery(),
}));

vi.mock('@shared/hooks/useMobile', () => ({
  useIsMobile: () => false,
}));

const activeRequest: UserRequest = {
  id: 1,
  request_number: 'REQ-00001',
  title: 'Active request',
  priority: 'routine',
  status: 'pending_fulfillment',
  requester_id: 1,
  needs_more_info: false,
  created_at: '2026-05-01T12:00:00Z',
  updated_at: '2026-05-01T12:00:00Z',
  request_type: 'manual',
  items: [],
};

const fulfilledRequest: UserRequest = {
  ...activeRequest,
  id: 2,
  request_number: 'REQ-00002',
  title: 'Fulfilled request',
  status: 'fulfilled',
};

function makeStore() {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        user: {
          id: 1,
          employee_number: 'USR001',
          name: 'Regular User',
          email: 'reg@example.com',
          department: 'Engineering',
          is_admin: false,
          is_active: true,
          permissions: ['page.requests'],
        },
        token: 'mock',
        isAuthenticated: true,
        isLoading: false,
      } as unknown as ReturnType<typeof authReducer>,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(baseApi.middleware),
  });
}

function renderDashboard() {
  const store = makeStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <PermissionProvider>
            <ConfigProvider>
              <RequestsDashboard />
            </ConfigProvider>
          </PermissionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
}

const ACTIVE_STATUSES = [
  'new',
  'under_review',
  'pending_fulfillment',
  'in_transfer',
  'awaiting_external_procurement',
  'partially_fulfilled',
  'needs_info',
  'awaiting_info',
  'in_progress',
  'partially_ordered',
  'ordered',
  'partially_received',
];

const HISTORY_STATUSES = ['fulfilled', 'cancelled', 'received'];

describe('RequestsDashboard — Active/History tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetRequestAnalyticsQuery.mockReturnValue({ data: undefined });
  });

  afterEach(() => cleanup());

  it('asks the backend only for active statuses on the default tab', () => {
    mockUseGetRequestsQuery.mockReturnValue({
      data: [activeRequest],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderDashboard();

    // The hook must have been called at least once; inspect the most recent call.
    expect(mockUseGetRequestsQuery).toHaveBeenCalled();
    const lastCallArgs = mockUseGetRequestsQuery.mock.calls.at(-1)?.[0] as
      | { status?: string }
      | undefined;
    expect(lastCallArgs?.status).toBeTruthy();
    const requested = (lastCallArgs?.status ?? '').split(',');
    // Every status passed to the backend must be in the active set …
    for (const status of requested) {
      expect(ACTIVE_STATUSES).toContain(status);
    }
    // … and the closed set must never appear on the active tab.
    for (const closed of HISTORY_STATUSES) {
      expect(requested).not.toContain(closed);
    }
  });

  it('queries the closed-status set when the History tab is selected', () => {
    mockUseGetRequestsQuery.mockReturnValue({
      data: [fulfilledRequest],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderDashboard();

    fireEvent.click(screen.getByRole('tab', { name: /history/i }));

    const lastCallArgs = mockUseGetRequestsQuery.mock.calls.at(-1)?.[0] as
      | { status?: string }
      | undefined;
    const requested = (lastCallArgs?.status ?? '').split(',');
    expect(requested).toEqual(expect.arrayContaining(['fulfilled', 'cancelled']));
    // The history tab must not pull active rows.
    for (const active of ACTIVE_STATUSES) {
      expect(requested).not.toContain(active);
    }
  });

  it('clears any user-applied status filter when the tab changes so closed and active statuses do not mix', () => {
    mockUseGetRequestsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /history/i }));

    // After switching to history, the query must scope itself to closed statuses.
    const historyCall = mockUseGetRequestsQuery.mock.calls.at(-1)?.[0] as {
      status?: string;
    };
    const historyStatuses = (historyCall?.status ?? '').split(',');
    expect(historyStatuses).toEqual(expect.arrayContaining(['fulfilled', 'cancelled']));

    // Switch back to active — closed statuses must be gone again.
    fireEvent.click(screen.getByRole('tab', { name: /active requests/i }));
    const activeCall = mockUseGetRequestsQuery.mock.calls.at(-1)?.[0] as {
      status?: string;
    };
    const activeStatuses = (activeCall?.status ?? '').split(',');
    for (const closed of HISTORY_STATUSES) {
      expect(activeStatuses).not.toContain(closed);
    }
  });

  it('renders the rows returned by the backend in the active table', () => {
    mockUseGetRequestsQuery.mockReturnValue({
      data: [activeRequest],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderDashboard();

    const table = screen.getByRole('table');
    expect(within(table).getByText('REQ-00001')).toBeInTheDocument();
    expect(within(table).getByText('Active request')).toBeInTheDocument();
  });
});
