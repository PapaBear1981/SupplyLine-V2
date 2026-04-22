import { test, expect } from '@playwright/test';

/**
 * Warehouse transfers landing page — structure, tab navigation, and History
 * tab smoke test.
 *
 * The full two-step transfer flow (initiate → receive) mutates inventory and
 * belongs to a future integration phase; here we verify page structure, tab
 * switching, and that the History tab renders its table (even when empty).
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

  test('all three tabs — Inbound, Outbound, History — are present', async ({ page }) => {
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();

    const tabs = page.locator('.ant-tabs-tab');
    await expect(tabs.filter({ hasText: 'Inbound' })).toBeVisible();
    await expect(tabs.filter({ hasText: 'Outbound' })).toBeVisible();
    await expect(tabs.filter({ hasText: 'History' })).toBeVisible();
  });

  test('History tab renders a table without errors', async ({ page }) => {
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();

    // Click the History tab
    await page.locator('.ant-tabs-tab').filter({ hasText: 'History' }).click();

    // The table should appear (Ant Design table wrapper)
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 8_000 });

    // No "Failed to load transfers." error message should appear
    await expect(page.getByText('Failed to load transfers.')).not.toBeVisible();
  });

  test('switching between tabs does not produce an error', async ({ page }) => {
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();

    for (const tabLabel of ['Outbound', 'History', 'Inbound']) {
      await page.locator('.ant-tabs-tab').filter({ hasText: tabLabel }).click();
      await expect(page.locator('.ant-table')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText('Failed to load transfers.')).not.toBeVisible();
    }
  });
});
