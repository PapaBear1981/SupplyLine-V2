import { test, expect } from '@playwright/test';

/**
 * Orders (Fulfillment) dashboard smoke coverage.
 *
 * Drives the live seeded backend via the shared authenticated
 * storageState. Deep fulfillment flows (create/approve/ship) are out of
 * Phase 4 scope — this spec guards the landing page and verifies the
 * primary CTA is wired up.
 */
test.describe('Orders / Fulfillment (desktop)', () => {
  test('orders dashboard renders', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByTestId('orders-page')).toBeVisible();
  });

  test('an antd Tabs control is mounted to switch fulfillment views', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.locator('.ant-tabs').first()).toBeVisible();
  });

  test('sidebar auto-expands the Operations group when landing on the orders page', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByTestId('nav-operations')).toBeVisible();
    await expect(page.getByTestId('nav-orders')).toBeVisible();
  });

  test('New Fulfillment Action button is visible on the Orders tab', async ({ page }) => {
    await page.goto('/orders');
    // activeTab defaults to 'requests'; the create button is conditionally
    // rendered only when the Orders (fulfillment) tab is active. Click the
    // tab by its accessible role+name so the selector is stable against
    // icon + text markup.
    const ordersTab = page.getByRole('tab', { name: /Fulfillment Queue/i });
    await expect(ordersTab).toBeVisible({ timeout: 10_000 });
    await ordersTab.click();
    await expect(ordersTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
    await expect(page.getByTestId('orders-create-button')).toBeVisible({ timeout: 10_000 });
  });
});
