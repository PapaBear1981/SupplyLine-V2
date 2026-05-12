import { test, expect } from '@playwright/test';

/**
 * Orders (Fulfillment) dashboard smoke coverage.
 *
 * The Fulfillment page now exposes Active Requests / History tabs instead of
 * the old Requests / Fulfillment Queue split. These tests cover the landing
 * page, the tab structure, and the CTA wiring against the seeded backend.
 */
test.describe('Orders / Fulfillment (desktop)', () => {
  test('orders dashboard renders', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByTestId('orders-page')).toBeVisible();
  });

  test('exposes Active Requests and History tabs (and no Fulfillment Queue tab)', async ({
    page,
  }) => {
    await page.goto('/orders');
    await expect(page.getByRole('tab', { name: /Active Requests/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('tab', { name: /History/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Fulfillment Queue/i })).toHaveCount(0);
  });

  test('History tab switches the dashboard view to closed requests', async ({ page }) => {
    await page.goto('/orders');
    const historyTab = page.getByRole('tab', { name: /History/i });
    await historyTab.click();
    await expect(historyTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
    // The history view labels its search input differently from the active view.
    // `destroyInactiveTabPane` is set on the Tabs, so only the active pane's
    // placeholder is in the DOM; `.first()` keeps the selector resilient if
    // that prop ever changes.
    await expect(
      page.getByPlaceholder(/search request history/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar auto-expands the Operations group when landing on the orders page', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByTestId('nav-operations')).toBeVisible();
    await expect(page.getByTestId('nav-orders')).toBeVisible();
  });

  test('New Request CTA is visible on the Fulfillment page', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByTestId('requests-create-button')).toBeVisible({ timeout: 10_000 });
  });
});
