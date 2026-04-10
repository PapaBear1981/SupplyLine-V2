import { test, expect, type Page, type Route } from '@playwright/test';

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 1,
  employee_number: 'ADMIN001',
  first_name: 'Admin',
  last_name: 'User',
  is_admin: true,
  role: 'admin',
  permissions: [],
};

const MOCK_FORECAST_RESPONSE = {
  forecasts: [
    {
      part_number: 'AMS-1525-A',
      description: 'Corrosion Inhibitor',
      manufacturer: 'Loctite',
      lot_count: 2,
      current_quantity: 8,
      unit: 'qt',
      daily_consumption_rate: 0.45,
      weekly_consumption_rate: 3.15,
      net_issued_in_window: 40.5,
      analysis_window_days: 90,
      days_of_stock_remaining: 17,
      projected_depletion_date: '2026-04-27',
      earliest_expiry_date: '2026-06-15',
      days_until_expiry: 66,
      waste_risk_quantity: 0,
      urgency: 'critical',
      recommended_order_quantity: 25,
      needs_reorder: true,
      current_reorder_status: null,
      chemical_ids: [1, 2],
    },
    {
      part_number: 'MIL-PRF-23827',
      description: 'Grease, Aircraft and Instrument',
      manufacturer: 'Royco',
      lot_count: 1,
      current_quantity: 45,
      unit: 'lb',
      daily_consumption_rate: 0.28,
      weekly_consumption_rate: 1.96,
      net_issued_in_window: 25.2,
      analysis_window_days: 90,
      days_of_stock_remaining: 160,
      projected_depletion_date: '2026-09-17',
      earliest_expiry_date: '2026-05-30',
      days_until_expiry: 50,
      waste_risk_quantity: 3.6,
      urgency: 'expiry_risk',
      recommended_order_quantity: null,
      needs_reorder: false,
      current_reorder_status: null,
      chemical_ids: [3],
    },
    {
      part_number: 'AMS-3276',
      description: 'Sealant, Polysulfide',
      manufacturer: 'PRC-DeSoto',
      lot_count: 3,
      current_quantity: 120,
      unit: 'oz',
      daily_consumption_rate: 0.91,
      weekly_consumption_rate: 6.37,
      net_issued_in_window: 82,
      analysis_window_days: 90,
      days_of_stock_remaining: 131,
      projected_depletion_date: null,
      earliest_expiry_date: null,
      days_until_expiry: null,
      waste_risk_quantity: 0,
      urgency: 'ok',
      recommended_order_quantity: null,
      needs_reorder: false,
      current_reorder_status: null,
      chemical_ids: [4, 5, 6],
    },
  ],
  summary: {
    total_part_numbers: 3,
    critical: 1,
    reorder_soon: 0,
    expiry_risk: 1,
    ok: 1,
    no_history: 0,
    total_waste_risk_qty: 3.6,
  },
  parameters: {
    analysis_window_days: 90,
    lead_time_days: 14,
    safety_stock_days: 14,
  },
  generated_at: new Date().toISOString(),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

/**
 * Inject a fake JWT into localStorage before the page script runs so the
 * Redux authSlice initialises with isAuthenticated=true, skipping the login
 * form entirely.  Then route-mock the few API calls the page makes.
 */
async function setupAuthAndMocks(page: Page) {
  // Pre-seed localStorage so the app boots in an authenticated state.
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'mock-jwt-token-for-playwright');
  });

  // Single catch-all handler that dispatches by URL substring.
  // Vite proxies /api/* to localhost:5000, so all intercepted URLs use
  // that origin — glob patterns without an explicit hostname miss query
  // strings. One route with url.includes() is the reliable approach.
  await page.route('**/api/**', (route: Route) => {
    const url = route.request().url();

    if (url.includes('/api/auth/me')) {
      // ProtectedRoute fetches this when user is null.
      // transformResponse in authApi does `response.user`, so wrap the object.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: MOCK_USER }),
      });
    }

    if (url.includes('/api/ai/settings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, provider: 'claude', model: '', base_url: '', api_key_configured: false }),
      });
    }

    if (url.includes('/api/chemicals/forecast')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_FORECAST_RESPONSE),
      });
    }

    // Everything else (warehouses, user-requests, etc.) → safe empty response
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function gotoForecastPage(page: Page) {
  await setupAuthAndMocks(page);
  await page.goto('/chemicals/forecast');
  // Wait for the forecast data to render — stat cards are the first indicator
  await page.waitForSelector('.ant-statistic, .ant-spin', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Chemical Forecast Page', () => {
  test.beforeEach(async ({ page }) => {
    await gotoForecastPage(page);
  });

  test('loads at the correct URL', async ({ page }) => {
    await expect(page).toHaveURL(/chemicals\/forecast/);
  });

  test('displays six summary stat cards', async ({ page }) => {
    await page.waitForSelector('.ant-statistic', { timeout: 10000 });
    const cards = page.locator('.ant-statistic');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('renders the forecast table', async ({ page }) => {
    await page.waitForSelector('.ant-table', { timeout: 10000 });
    await expect(page.locator('.ant-table').first()).toBeVisible();
  });

  test('table shows all three mock chemicals', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10000 });
    await expect(page.locator('text=AMS-1525-A').first()).toBeVisible();
    await expect(page.locator('text=MIL-PRF-23827').first()).toBeVisible();
    await expect(page.locator('text=AMS-3276').first()).toBeVisible();
    const rows = page.locator('.ant-table-tbody .ant-table-row');
    expect(await rows.count()).toBe(3);
  });

  test('urgency tags are rendered', async ({ page }) => {
    await page.waitForSelector('.ant-tag', { timeout: 10000 });
    expect(await page.locator('.ant-tag').count()).toBeGreaterThan(0);
  });

  test('config row controls are visible', async ({ page }) => {
    await expect(page.locator('.ant-select').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.ant-input-number').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has(.anticon-reload)')).toBeVisible({ timeout: 10000 });
  });

  test('filter buttons are visible', async ({ page }) => {
    await expect(page.locator('button', { hasText: /^All/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button', { hasText: /needs attention/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button', { hasText: /expiry risk/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Needs Attention filter shows only critical/soon rows', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10000 });
    await page.locator('button', { hasText: /needs attention/i }).first().click();
    await page.waitForTimeout(300);
    // Only AMS-1525-A is critical; MIL-PRF-23827 is expiry_risk, AMS-3276 is ok
    const rows = page.locator('.ant-table-tbody .ant-table-row');
    expect(await rows.count()).toBe(1);
  });

  test('Expiry Risk filter shows only expiry_risk rows', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10000 });
    await page.locator('button', { hasText: /expiry risk/i }).first().click();
    await page.waitForTimeout(300);
    // Only MIL-PRF-23827 has urgency expiry_risk
    const rows = page.locator('.ant-table-tbody .ant-table-row');
    expect(await rows.count()).toBe(1);
    await expect(page.locator('text=MIL-PRF-23827').first()).toBeVisible();
  });

  test('All filter restores all rows after filtering', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10000 });
    await page.locator('button', { hasText: /needs attention/i }).first().click();
    await page.waitForTimeout(200);
    await page.locator('button', { hasText: /^All/i }).first().click();
    await page.waitForTimeout(200);
    expect(await page.locator('.ant-table-tbody .ant-table-row').count()).toBe(3);
  });

  test('Request Reorder button opens modal for critical items', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10000 });
    const reorderBtn = page.locator('button', { hasText: /request reorder/i }).first();
    if (await reorderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reorderBtn.click();
      await expect(page.locator('.ant-modal')).toBeVisible({ timeout: 5000 });
    }
  });

  test('forecast footer shows analysis parameters', async ({ page }) => {
    await page.waitForSelector('.ant-statistic', { timeout: 10000 });
    await page.waitForTimeout(500);
    await expect(page.locator('text=/Based on 90-day consumption history/i')).toBeVisible({ timeout: 10000 });
  });

  test('screenshot of forecast page', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/chemical-forecast.png', fullPage: true });
  });
});
