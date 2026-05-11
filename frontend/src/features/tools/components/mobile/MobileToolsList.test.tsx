import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ConfigProvider } from 'antd';

import { baseApi } from '@services/baseApi';
import authReducer from '@features/auth/slices/authSlice';
import { PermissionProvider } from '@features/auth/context/PermissionContext';
import { ThemeProvider } from '@features/settings/contexts/ThemeContext';

import { MobileToolsList } from './MobileToolsList';
import type { Tool } from '../../types';

// ── Hook mocks ───────────────────────────────────────────────────────────────
const mockUseGetToolsQuery = vi.fn();
const mockUseGetToolQuery = vi.fn();
const mockUseGetWarehousesQuery = vi.fn();

vi.mock('../../services/toolsApi', () => ({
  useGetToolsQuery: (...args: unknown[]) => mockUseGetToolsQuery(...args),
  useGetToolQuery: (...args: unknown[]) => mockUseGetToolQuery(...args),
  useCreateToolMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateToolMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteToolMutation: () => [vi.fn(), { isLoading: false }],
  useGetToolCalibrationsQuery: () => ({ data: [], isLoading: false, isError: false }),
  // Stub the slice's invalidateTags thunk creator. The component dispatches
  // it on pull-to-refresh from page 2+; the test only needs a serializable
  // action object so the store's middleware doesn't blow up.
  toolsApi: {
    util: {
      invalidateTags: vi.fn((tags: unknown) => ({
        type: 'toolsApi/invalidateTags',
        payload: tags,
      })),
    },
  },
}));

vi.mock('@features/warehouses/services/warehousesApi', () => ({
  useGetWarehousesQuery: () => mockUseGetWarehousesQuery(),
}));

vi.mock('@features/tool-checkout', () => ({
  useGetToolTimelineQuery: () => ({ data: { timeline: [] }, isLoading: false, isError: false }),
}));

vi.mock('./MobileToolLabelSheet', () => ({
  MobileToolLabelSheet: () => null,
}));

// Replace antd-mobile's InfiniteScroll + PullToRefresh with deterministic
// stubs so tests can drive loadMore / onRefresh without IntersectionObserver
// or touch-event simulation. Other antd-mobile exports pass through unchanged.
vi.mock('antd-mobile', async () => {
  const actual = await vi.importActual<typeof import('antd-mobile')>('antd-mobile');
  return {
    ...actual,
    InfiniteScroll: ({
      loadMore,
      hasMore,
    }: {
      loadMore: () => Promise<void>;
      hasMore: boolean;
    }) => (
      <button
        data-testid="infinite-scroll-trigger"
        data-has-more={String(hasMore)}
        disabled={!hasMore}
        onClick={() => {
          void loadMore();
        }}
      >
        load more
      </button>
    ),
    PullToRefresh: ({
      children,
      onRefresh,
    }: {
      children: React.ReactNode;
      onRefresh: () => Promise<unknown>;
    }) => (
      <div>
        <button
          data-testid="pull-to-refresh-trigger"
          onClick={() => {
            void onRefresh();
          }}
        >
          refresh
        </button>
        {children}
      </div>
    ),
  };
});

// ── Test helpers ─────────────────────────────────────────────────────────────
function makeTool(overrides: Partial<Tool> = {}): Tool {
  const id = overrides.id ?? 1;
  return {
    id,
    tool_number: `T${String(id).padStart(3, '0')}`,
    serial_number: `SN${id}`,
    description: 'Test tool',
    condition: 'good',
    location: 'Bay A',
    category: 'General',
    status: 'available',
    warehouse_id: 1,
    warehouse_name: 'Main',
    created_at: '2025-01-01T00:00:00Z',
    requires_calibration: false,
    calibration_status: 'not_applicable',
    ...overrides,
  } as Tool;
}

function makePage(ids: number[], pageNum: number, totalPages: number) {
  return {
    tools: ids.map((id) => makeTool({ id })),
    total: totalPages * 20,
    page: pageNum,
    per_page: 20,
    pages: totalPages,
  };
}

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
          employee_number: 'ADMIN001',
          name: 'Admin',
          email: 'a@b.com',
          department: 'Materials',
          is_admin: true,
          is_active: true,
          permissions: ['tool.create', 'tool.edit', 'tool.delete'],
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

function withProviders(
  store: ReturnType<typeof makeStore>,
  children: React.ReactNode
): React.ReactElement {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <PermissionProvider>
            <ConfigProvider>
              {children}
            </ConfigProvider>
          </PermissionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
}

function renderMobile() {
  const store = makeStore();
  const utils = render(withProviders(store, <MobileToolsList />));
  // Returning the store + a state-preserving rerender helper lets individual
  // tests force a re-render of the same component instance (so its accumulator
  // state survives) without duplicating the provider tree.
  return {
    ...utils,
    store,
    rerenderSame: () => utils.rerender(withProviders(store, <MobileToolsList />)),
  };
}

// Returns the visible tool numbers in the order they appear in the DOM.
function visibleToolNumbers(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid^="mobile-tool-item-"]')
  )
    .map((el) => el.querySelector('.tool-item-title')?.textContent?.trim() ?? '')
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('MobileToolsList — infinite scroll pagination', () => {
  beforeEach(() => {
    cleanup();
    mockUseGetToolsQuery.mockReset();
    mockUseGetToolQuery.mockReset();
    mockUseGetToolQuery.mockReturnValue({ data: undefined });
    mockUseGetWarehousesQuery.mockReset();
    mockUseGetWarehousesQuery.mockReturnValue({ data: { warehouses: [] } });
  });

  it('renders the first page of tools', () => {
    mockUseGetToolsQuery.mockReturnValue({
      data: makePage([1, 2, 3], 1, 2),
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderMobile();

    expect(visibleToolNumbers()).toEqual(['T001', 'T002', 'T003']);
  });

  it('shows the skeleton placeholder on initial load (no data yet)', () => {
    mockUseGetToolsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      refetch: vi.fn(),
    });

    renderMobile();

    // No tool rows yet, but the skeleton placeholders render in their place.
    expect(visibleToolNumbers()).toEqual([]);
    expect(document.querySelector('.tool-skeleton')).not.toBeNull();
  });

  it('appends page 2 onto page 1 when InfiniteScroll fires loadMore', async () => {
    // Each call to useGetToolsQuery is identified by the page arg. Stable
    // array references per page mimic RTK Query's cache behavior, which the
    // accumulator's identity check relies on to know whether a fetch is new.
    const page1 = makePage([1, 2], 1, 2);
    const page2 = makePage([3, 4], 2, 2);
    mockUseGetToolsQuery.mockImplementation((args: { page?: number } | void) => {
      const p = args?.page ?? 1;
      const data = p === 1 ? page1 : page2;
      return { data, isLoading: false, isFetching: false, refetch: vi.fn() };
    });

    renderMobile();

    expect(visibleToolNumbers()).toEqual(['T001', 'T002']);

    // User scrolls to the bottom — the InfiniteScroll trigger fires loadMore.
    fireEvent.click(screen.getByTestId('infinite-scroll-trigger'));

    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T001', 'T002', 'T003', 'T004']);
    });
  });

  it('keeps page-1 items visible while page 2 is fetching (no skeleton flash)', async () => {
    // Simulate the in-flight refetch state for page 2: data is undefined but
    // isFetching is true. Without the fix, the entire list would unmount and
    // be replaced with skeletons, which is the regression that traps scroll.
    const page1 = makePage([1, 2, 3], 1, 2);
    let currentPage = 1;
    mockUseGetToolsQuery.mockImplementation((args: { page?: number } | void) => {
      currentPage = args?.page ?? 1;
      if (currentPage === 1) {
        return { data: page1, isLoading: false, isFetching: false, refetch: vi.fn() };
      }
      // Page 2 in flight: no cached data, isFetching=true.
      return { data: undefined, isLoading: true, isFetching: true, refetch: vi.fn() };
    });

    renderMobile();

    expect(visibleToolNumbers()).toEqual(['T001', 'T002', 'T003']);

    fireEvent.click(screen.getByTestId('infinite-scroll-trigger'));

    // Page 1 items must remain visible even though the page-2 request is
    // still in flight. The skeleton placeholder must NOT appear (it's only
    // for the truly initial empty-list load).
    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T001', 'T002', 'T003']);
    });
    expect(document.querySelector('.tool-skeleton')).toBeNull();
  });

  it('disables the InfiniteScroll trigger once the last page is loaded', () => {
    mockUseGetToolsQuery.mockReturnValue({
      data: makePage([1, 2], 1, 1), // page 1 of 1
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderMobile();

    const trigger = screen.getByTestId('infinite-scroll-trigger');
    expect(trigger).toBeDisabled();
    expect(trigger.getAttribute('data-has-more')).toBe('false');
  });

  it('ignores duplicate loadMore calls while a fetch is already in flight', async () => {
    // hasMore is gated by `!isFetching` in the component, so the trigger
    // becomes disabled mid-fetch — but we also defend inside loadMore so a
    // race between scroll events can't double-bump page state.
    mockUseGetToolsQuery.mockReturnValue({
      data: makePage([1, 2], 1, 5),
      isLoading: false,
      isFetching: true, // simulate a fetch still in flight
      refetch: vi.fn(),
    });

    renderMobile();

    const trigger = screen.getByTestId('infinite-scroll-trigger');
    // Click should be a no-op while isFetching: hasMore-driven disable means
    // the request page in the latest hook call must remain at 1.
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    const lastArgs = mockUseGetToolsQuery.mock.calls.at(-1)?.[0] as { page?: number };
    expect(lastArgs.page).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('MobileToolsList — list reset behavior', () => {
  beforeEach(() => {
    cleanup();
    mockUseGetToolsQuery.mockReset();
    mockUseGetToolQuery.mockReset();
    mockUseGetToolQuery.mockReturnValue({ data: undefined });
    mockUseGetWarehousesQuery.mockReset();
    mockUseGetWarehousesQuery.mockReturnValue({ data: { warehouses: [] } });
  });

  it('clears accumulated pages when the search query changes', async () => {
    // Mock returns different tools per (page, q) combination, with stable
    // references per call so the merge identity check works correctly.
    const page1Empty = makePage([1, 2], 1, 2);
    const page2Empty = makePage([3, 4], 2, 2);
    const page1Search = makePage([10], 1, 1);
    mockUseGetToolsQuery.mockImplementation((args: { page?: number; q?: string } | void) => {
      const p = args?.page ?? 1;
      const q = args?.q;
      if (q) return { data: page1Search, isLoading: false, isFetching: false, refetch: vi.fn() };
      const data = p === 1 ? page1Empty : page2Empty;
      return { data, isLoading: false, isFetching: false, refetch: vi.fn() };
    });

    renderMobile();
    fireEvent.click(screen.getByTestId('infinite-scroll-trigger'));
    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T001', 'T002', 'T003', 'T004']);
    });

    // Type a search query — must reset the accumulated list to the new
    // query's page-1 results, not append onto the old four. SearchBar
    // renders <input type="search">, whose implicit ARIA role is "searchbox".
    const searchInput = within(screen.getByTestId('mobile-tools-search')).getByRole(
      'searchbox'
    );
    fireEvent.change(searchInput, { target: { value: 'wrench' } });

    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T010']);
    });
  });

  it('clears accumulated pages when the status filter changes', async () => {
    const allPage1 = makePage([1, 2], 1, 2);
    const allPage2 = makePage([3, 4], 2, 2);
    const filteredPage1 = makePage([20], 1, 1);
    mockUseGetToolsQuery.mockImplementation(
      (args: { page?: number; status?: string } | void) => {
        const p = args?.page ?? 1;
        const status = args?.status;
        if (status) {
          return {
            data: filteredPage1,
            isLoading: false,
            isFetching: false,
            refetch: vi.fn(),
          };
        }
        const data = p === 1 ? allPage1 : allPage2;
        return { data, isLoading: false, isFetching: false, refetch: vi.fn() };
      }
    );

    renderMobile();
    fireEvent.click(screen.getByTestId('infinite-scroll-trigger'));
    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T001', 'T002', 'T003', 'T004']);
    });

    // Open the filter popup and pick "Maintenance".
    fireEvent.click(screen.getByTestId('mobile-tools-filter-button'));
    const filterPopup = await screen.findByText('Filter Tools');
    const popupRoot = filterPopup.closest('.filter-popup');
    expect(popupRoot).not.toBeNull();
    fireEvent.click(within(popupRoot as HTMLElement).getByText('Maintenance'));

    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T020']);
    });
  });

  it('replaces the page-1 list when pull-to-refresh provides a fresh array', async () => {
    // RTK Query returns a new array reference on every successful fetch; the
    // accumulator detects this via identity comparison and replaces page 1.
    const initialPage1 = makePage([1, 2], 1, 1);
    const refreshedPage1 = makePage([5, 6, 7], 1, 1);
    let served = initialPage1;
    const refetch = vi.fn(() => {
      served = refreshedPage1;
    });
    mockUseGetToolsQuery.mockImplementation(() => ({
      data: served,
      isLoading: false,
      isFetching: false,
      refetch,
    }));

    const { rerenderSame } = renderMobile();
    expect(visibleToolNumbers()).toEqual(['T001', 'T002']);

    // Pull-to-refresh triggers refetch(); flip the served data and force
    // a re-render of the same component instance so the merge picks up
    // the new array reference for page 1 and replaces pageSlices[1].
    fireEvent.click(screen.getByTestId('pull-to-refresh-trigger'));
    expect(refetch).toHaveBeenCalled();
    rerenderSame();

    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T005', 'T006', 'T007']);
    });
  });

  it('replaces an already-merged page when its refetch returns updated rows', async () => {
    // Regression: a refetch of page N (after edit / delete / cache
    // invalidation) hands back a fresh array reference for the same page
    // arg. The merge logic must REPLACE pageSlices[N] in place — not skip
    // the update because the ids overlap. With the original append-only
    // merge, an edited or deleted page-2 row stayed stale forever.
    const page1Initial = makePage([1, 2], 1, 2);
    const page2Initial = makePage([3, 4], 2, 2);
    // After the "edit", id=3 is gone (e.g. status changed and now filtered
    // out) and id=4 is renamed via tool_number "T444".
    const page2Edited = {
      ...page2Initial,
      tools: [makeTool({ id: 4, tool_number: 'T444' })],
    };

    // Use a mutable holder so each call gets the latest mocked array for
    // its page arg, while keeping array references stable per page until
    // the test explicitly swaps them.
    const responses: Record<number, ReturnType<typeof makePage>> = {
      1: page1Initial,
      2: page2Initial,
    };
    mockUseGetToolsQuery.mockImplementation(
      (args: { page?: number } | void) => {
        const p = args?.page ?? 1;
        return {
          data: responses[p],
          isLoading: false,
          isFetching: false,
          refetch: vi.fn(),
        };
      }
    );

    const { rerenderSame } = renderMobile();
    fireEvent.click(screen.getByTestId('infinite-scroll-trigger'));
    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T001', 'T002', 'T003', 'T004']);
    });

    // Swap in the "edited" page-2 response — a new array reference for the
    // same {page:2} arg, mimicking the refetch that follows
    // invalidatesTags([{type:'Tool', id:'LIST'}]) on a mutation. Then force
    // a re-render of the SAME component instance (same store, same React
    // tree) so the accumulator state is preserved and the merge has to
    // decide whether to replace pageSlices[2] in place.
    responses[2] = page2Edited;
    rerenderSame();

    await waitFor(() => {
      // id=3 must be gone, id=4 must show its new tool_number "T444";
      // page-1 ids 1 + 2 are untouched. With the old append-only merge,
      // T003 + T004 would have lingered (T444 ignored because id=4 was
      // already in the set).
      expect(visibleToolNumbers()).toEqual(['T001', 'T002', 'T444']);
    });
  });

  it('forces a fresh page-1 fetch when pull-to-refresh fires from page 2+', async () => {
    // Bug fixed: a previous handleRefresh did `setPage(1); await refetch()`,
    // but refetch() targets the still-subscribed page-2 entry (state
    // updates only take effect after the current handler returns). Once
    // the new render subscribes to {page:1}, RTK Query would serve the
    // existing page-1 cache without refetching, so the user saw stale
    // data. The fix dispatches invalidateTags for the LIST so the
    // post-render fetch is forced.
    const page1 = makePage([1, 2], 1, 2);
    const page2 = makePage([3, 4], 2, 2);
    const refetch = vi.fn();
    mockUseGetToolsQuery.mockImplementation(
      (args: { page?: number } | void) => {
        const p = args?.page ?? 1;
        return {
          data: p === 1 ? page1 : page2,
          isLoading: false,
          isFetching: false,
          refetch,
        };
      }
    );

    renderMobile();
    fireEvent.click(screen.getByTestId('infinite-scroll-trigger'));
    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T001', 'T002', 'T003', 'T004']);
    });

    // Pull-to-refresh while at page 2.
    fireEvent.click(screen.getByTestId('pull-to-refresh-trigger'));

    // 1. refetch() must NOT be called: it would target the stale {page:2}
    //    subscription. The fix uses invalidateTags + setPage(1) instead.
    expect(refetch).not.toHaveBeenCalled();

    // 2. The accumulator must drop pages 2+; only fresh page-1 rows remain.
    //    With the bug, the stale page-2 rows (T003, T004) lingered after the
    //    refresh.
    await waitFor(() => {
      expect(visibleToolNumbers()).toEqual(['T001', 'T002']);
    });

    // 3. The latest hook call should be for {page:1} — proves we navigated
    //    back to the first page rather than just refetching in place.
    const lastArgs = mockUseGetToolsQuery.mock.calls.at(-1)?.[0] as {
      page?: number;
    };
    expect(lastArgs.page).toBe(1);
  });
});
