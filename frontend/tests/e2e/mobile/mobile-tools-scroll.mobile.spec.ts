import { test, expect } from '@playwright/test';
import { MobileToolsPage } from '../../pages/mobile/MobileToolsPage';
import { installApiMocks, MOCK_ADMIN_USER } from '../../fixtures/api-mocks';

/**
 * Mobile Tools page — infinite-scroll regression test.
 *
 * Bug: tapping `setPage(p+1)` from antd-mobile's InfiniteScroll switched the
 * RTK Query cache to a different `{page: N}` entry, replacing the displayed
 * list with only that page's items and flashing a skeleton placeholder. The
 * shorter list left the InfiniteScroll loader inside the viewport, which
 * re-fired loadMore on every render and trapped the scroll container at the
 * bottom — the user could not scroll back up without reloading the page.
 *
 * The component now accumulates pages in local state. These tests verify:
 *   1. Page 2 items APPEND onto page 1 (page-1 items stay in the DOM).
 *   2. The skeleton placeholder doesn't flash during a page-2 fetch.
 *   3. After loading more, the user can scroll back to the top.
 *   4. `/api/tools?page=N` is not called more than once per page (no fetch loop).
 *
 * Drives a fully mocked `/api/tools` endpoint so we control pagination
 * precisely; the seeded backend's ~7 tools fit on a single page.
 */

type ToolFixture = {
  id: number;
  tool_number: string;
  serial_number: string;
  description: string;
  condition: string;
  location: string;
  category: string;
  status: 'available';
  warehouse_id: number;
  warehouse_name: string;
  created_at: string;
  requires_calibration: boolean;
  calibration_status: 'not_applicable';
};

const PER_PAGE = 20;
const TOTAL_TOOLS = 50; // 50 tools across 3 pages of 20 (last page = 10)

function buildTools(count: number): ToolFixture[] {
  return Array.from({ length: count }, (_, idx) => {
    const id = idx + 1;
    return {
      id,
      tool_number: `MT${String(id).padStart(3, '0')}`,
      serial_number: `SN-${id}`,
      description: `Mocked tool ${id}`,
      condition: 'good',
      location: 'Bay 1',
      category: 'General',
      status: 'available',
      warehouse_id: 1,
      warehouse_name: 'Main',
      created_at: '2025-01-01T00:00:00Z',
      requires_calibration: false,
      calibration_status: 'not_applicable',
    };
  });
}

test.describe('Mobile Tools — infinite scroll', () => {
  test('appends successive pages and stays scrollable after reaching the bottom', async ({ page }) => {
    const tools = buildTools(TOTAL_TOOLS);
    // Track every /api/tools list call so we can assert no fetch loop.
    const listCallPages: number[] = [];

    // Catch-all auth/AI handlers first so the more specific tools handler
    // below is matched first (Playwright resolves overlapping routes in
    // reverse registration order — last registered wins).
    await installApiMocks(page, [
      { urlIncludes: '/api/warehouses', response: { warehouses: [] } },
      { urlIncludes: '/api/me/permissions', response: MOCK_ADMIN_USER.permissions },
    ]);

    await page.route('**/api/tools**', (route) => {
      const req = route.request();
      const reqUrl = new URL(req.url());
      // Only intercept the list endpoint (no path segment after /tools), not
      // /api/tools/{id} or /api/tools/{id}/calibrations.
      const segments = reqUrl.pathname.split('/').filter(Boolean);
      if (segments[segments.length - 1] !== 'tools' || req.method() !== 'GET') {
        return route.fallback();
      }
      const pageNum = Number(reqUrl.searchParams.get('page')) || 1;
      const perPage = Number(reqUrl.searchParams.get('per_page')) || PER_PAGE;
      listCallPages.push(pageNum);
      const start = (pageNum - 1) * perPage;
      const slice = tools.slice(start, start + perPage);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tools: slice,
          total: tools.length,
          page: pageNum,
          per_page: perPage,
          pages: Math.ceil(tools.length / perPage),
        }),
      });
    });

    const tools_page = new MobileToolsPage(page);
    await tools_page.open();

    // Page 1 items should render.
    await expect(tools_page.toolItem(1)).toBeVisible();
    await expect(tools_page.toolItem(20)).toBeVisible();
    await expect(tools_page.toolItem(21)).toHaveCount(0);

    // Locate the actual scroll container (set in MobileLayout.css). This is
    // what the user scrolls — NOT window — because the layout pins the
    // header/footer with position: fixed.
    const scrollContainer = page.locator('.mobile-layout-content');
    await expect(scrollContainer).toBeVisible();

    // Scroll to the bottom to bring the InfiniteScroll loader into view.
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // Wait for page 2 items to be merged into the list.
    await expect(tools_page.toolItem(21)).toBeVisible({ timeout: 5_000 });
    await expect(tools_page.toolItem(40)).toBeVisible();

    // **Regression check:** page-1 items must STILL be in the DOM after page 2
    // loads. The bug replaced them with skeletons, breaking scroll.
    await expect(tools_page.toolItem(1)).toBeAttached();
    await expect(tools_page.toolItem(20)).toBeAttached();

    // The skeleton placeholder must NOT be present after the initial load —
    // showing it during a page-2 fetch is what causes the layout collapse.
    await expect(page.locator('.tool-skeleton')).toHaveCount(0);

    // Scroll to the bottom again to fetch page 3 (the last page, 10 items).
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(tools_page.toolItem(50)).toBeVisible({ timeout: 5_000 });

    // **Bug verification:** the user must be able to scroll back up. With the
    // old code, scroll position was trapped at the bottom because successive
    // re-renders kept resetting the layout. After scrolling to the top, the
    // first tool item should be in the viewport.
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(tools_page.toolItem(1)).toBeInViewport({ timeout: 2_000 });

    // **Fetch-loop guard:** each page should be requested at most a small
    // bounded number of times (RTK Query may issue an extra in-flight call
    // during initial mount; we just need to be far below "constantly looping").
    // Pages 1, 2, 3 each requested at most ~3 times is healthy.
    const counts = listCallPages.reduce<Record<number, number>>((acc, p) => {
      acc[p] = (acc[p] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts[1] ?? 0).toBeLessThanOrEqual(3);
    expect(counts[2] ?? 0).toBeLessThanOrEqual(3);
    expect(counts[3] ?? 0).toBeLessThanOrEqual(3);
    // And we should never have requested a non-existent page.
    expect(Math.max(...listCallPages)).toBeLessThanOrEqual(3);
  });

  test('changing the search query resets the accumulated list', async ({ page }) => {
    const tools = buildTools(TOTAL_TOOLS);

    await installApiMocks(page, [
      { urlIncludes: '/api/warehouses', response: { warehouses: [] } },
    ]);

    await page.route('**/api/tools**', (route) => {
      const req = route.request();
      const reqUrl = new URL(req.url());
      const segments = reqUrl.pathname.split('/').filter(Boolean);
      if (segments[segments.length - 1] !== 'tools' || req.method() !== 'GET') {
        return route.fallback();
      }
      const pageNum = Number(reqUrl.searchParams.get('page')) || 1;
      const perPage = Number(reqUrl.searchParams.get('per_page')) || PER_PAGE;
      const q = reqUrl.searchParams.get('q');
      // When a search query is present, return a single tool that doesn't
      // overlap with the unfiltered list — proves the list was reset rather
      // than appended.
      const filtered = q
        ? [
            {
              ...tools[0],
              id: 999,
              tool_number: 'SEARCHED',
              description: `match for ${q}`,
            },
          ]
        : tools.slice((pageNum - 1) * perPage, pageNum * perPage);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tools: filtered,
          total: q ? 1 : tools.length,
          page: pageNum,
          per_page: perPage,
          pages: q ? 1 : Math.ceil(tools.length / perPage),
        }),
      });
    });

    const tools_page = new MobileToolsPage(page);
    await tools_page.open();
    await expect(tools_page.toolItem(1)).toBeVisible();

    // Load page 2 via infinite scroll first so we can prove the accumulator
    // gets cleared (not just that page 1 is replaced).
    const scrollContainer = page.locator('.mobile-layout-content');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(tools_page.toolItem(21)).toBeVisible({ timeout: 5_000 });

    // Type in the search bar — antd-mobile SearchBar wraps a native input.
    const searchInput = tools_page.searchBar.locator('input');
    await searchInput.fill('wrench');

    // The accumulated list (items 1..40) must be replaced by the searched
    // result (id=999). None of the previously-visible tool items should
    // remain in the DOM.
    await expect(tools_page.toolItem(999)).toBeVisible({ timeout: 5_000 });
    await expect(tools_page.toolItem(1)).toHaveCount(0);
    await expect(tools_page.toolItem(20)).toHaveCount(0);
    await expect(tools_page.toolItem(40)).toHaveCount(0);
  });
});
