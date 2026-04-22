import { test, expect } from '@playwright/test';
import { MobileNavigation } from '../../pages/mobile/MobileNavigation';

/**
 * Warehouse transfers on a mobile viewport.
 *
 * Mirrors warehouse-transfer.desktop.spec.ts: verifies the page structure
 * and that the initiate-transfer modal opens. The full transfer flow belongs
 * to a future integration phase.
 *
 * Drives the live seeded backend via the shared authenticated storageState.
 */
test.describe('Warehouse transfers (mobile)', () => {
  test('transfers page renders with its tabs and CTA', async ({ page }) => {
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    await expect(page.locator('.ant-tabs').first()).toBeVisible();
    await expect(page.getByTestId('transfers-create-button')).toBeVisible();
  });

  test('initiate transfer opens a modal', async ({ page }) => {
    await page.goto('/transfers');
    await page.getByTestId('transfers-create-button').click();
    await expect(page.locator('.ant-modal').first()).toBeVisible({ timeout: 5_000 });
  });

  test('transfers page is reachable via the mobile More menu', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = new MobileNavigation(page);
    await nav.goToMenuItem('transfers');
    await expect(page).toHaveURL(/\/transfers/);
    await expect(page.getByTestId('transfers-page')).toBeVisible({ timeout: 10_000 });
  });
});
