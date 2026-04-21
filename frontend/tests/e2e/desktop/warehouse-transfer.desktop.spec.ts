import { test, expect } from '@playwright/test';

/**
 * Warehouse transfers landing page + initiate-modal smoke.
 *
 * The full transfer flow (pick source/dest, select items, confirm)
 * mutates inventory in the seeded DB and belongs to a future integration
 * phase; here we only verify the page structure and that the initiate
 * modal can open.
 */
test.describe('Warehouse transfers (desktop)', () => {
  test('transfers page renders with its tabs and CTA', async ({ page }) => {
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    await expect(page.locator('.ant-tabs').first()).toBeVisible();
    await expect(page.getByTestId('transfers-create-button')).toBeVisible();
  });

  test('Initiate transfer opens a modal', async ({ page }) => {
    await page.goto('/transfers');
    await page.getByTestId('transfers-create-button').click();
    await expect(page.locator('.ant-modal').first()).toBeVisible({ timeout: 5_000 });
  });
});
