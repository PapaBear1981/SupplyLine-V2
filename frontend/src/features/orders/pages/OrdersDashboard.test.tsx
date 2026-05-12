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

import { OrdersDashboard } from './OrdersDashboard';
import type { UserRequest } from '../types';

/**
 * The Fulfillment dashboard used to show two tabs (Requests + Fulfillment
 * Queue). That second tab was confusing to buyers, so it's been removed and
 * the dashboard now shows Active Requests + History tabs that mirror the
 * Requests page. These tests pin down the new tab structure:
 *
 *   1. The Fulfillment Queue tab is gone (no procurement-order list).
 *   2. The Active tab queries only active statuses; History queries only
 *      closed statuses.
 *   3. Buyer information surfaces in the active table since it was the
 *      most useful column from the old queue view.
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
  id: 11,
  request_number: 'REQ-00011',
  title: 'In-progress request',
  priority: 'urgent',
  status: 'pending_fulfillment',
  requester_id: 1,
  buyer_id: 2,
  buyer_name: 'Buyer User',
  requester_name: 'Mechanic',
  needs_more_info: false,
  created_at: '2026-05-01T12:00:00Z',
  updated_at: '2026-05-01T12:00:00Z',
  request_type: 'manual',
  items: [],
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
          employee_number: 'BUY001',
          name: 'Buyer',
          email: 'buyer@example.com',
          department: 'Materials',
          is_admin: false,
          is_active: true,
          permissions: ['page.orders', 'page.requests'],
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
              <OrdersDashboard />
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
];
const HISTORY_STATUSES = ['fulfilled', 'cancelled', 'received'];

describe('OrdersDashboard — Active/History tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetRequestAnalyticsQuery.mockReturnValue({
      data: { total_count: 1, late_count: 0, status_breakdown: { pending_fulfillment: 1 } },
    });
  });

  afterEach(() => cleanup());

  it('does not render a Fulfillment Queue tab', () => {
    mockUseGetRequestsQuery.mockReturnValue({
      data: [activeRequest],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderDashboard();

    // Active Requests + History should be the only tabs.
    expect(screen.getByRole('tab', { name: /active requests/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /fulfillment queue/i })).toBeNull();
  });

  it('queries only active statuses on the Active Requests tab', () => {
    mockUseGetRequestsQuery.mockReturnValue({
      data: [activeRequest],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderDashboard();

    const params = mockUseGetRequestsQuery.mock.calls.at(-1)?.[0] as {
      status?: string;
    };
    const requested = (params?.status ?? '').split(',');
    for (const closed of HISTORY_STATUSES) {
      expect(requested).not.toContain(closed);
    }
    // At least one well-known active status must be requested.
    expect(requested.some((s) => ACTIVE_STATUSES.includes(s))).toBe(true);
  });

  it('switches to closed statuses when the History tab is clicked', () => {
    mockUseGetRequestsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /history/i }));

    const params = mockUseGetRequestsQuery.mock.calls.at(-1)?.[0] as {
      status?: string;
    };
    const requested = (params?.status ?? '').split(',');
    expect(requested).toEqual(expect.arrayContaining(['fulfilled', 'cancelled']));
  });

  it('surfaces the buyer column on the active table (merged from old fulfillment queue)', () => {
    mockUseGetRequestsQuery.mockReturnValue({
      data: [activeRequest],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderDashboard();

    const table = screen.getByRole('table');
    // A column header with exact text "Buyer" must be present (distinct from
    // the cell value "Buyer User"). Antd uses a <th> for headers.
    const buyerHeaders = within(table)
      .getAllByRole('columnheader')
      .filter((h) => h.textContent === 'Buyer');
    expect(buyerHeaders.length).toBe(1);
    // And the buyer name from the row is rendered in the body.
    expect(within(table).getByText('Buyer User')).toBeInTheDocument();
  });
});
