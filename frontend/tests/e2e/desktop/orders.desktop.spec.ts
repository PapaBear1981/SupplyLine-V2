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

  test('New Fulfillment Action button is visible on the orders tab', async ({ page }) => {
    await page.goto('/orders');
    // activeTab defaults to 'orders', so the create button is rendered.
    await expect(page.getByTestId('orders-create-button')).toBeVisible({ timeout: 10_000 });
  });
});
