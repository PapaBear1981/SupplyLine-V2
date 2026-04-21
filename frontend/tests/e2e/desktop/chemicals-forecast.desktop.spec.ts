import { test, expect } from '@playwright/test';
import { mockAuthedForecast } from '../../fixtures/forecast-mock';

/**
 * Chemical-Forecast page — ported from the pre-rebuild
 * `chemical-forecast.spec.ts`. Kept as the reference pattern for all future
 * API-mocked specs: no dependency on the live backend, no waitForTimeout
 * beyond small post-click UI settles, and all selectors are scoped to the
 * forecast page's own markup.
 *
 * Uses the shared storageState written by the `setup` project, so the app
 * boots authenticated and we only need to stub the forecast endpoint.
 */
test.describe('Chemicals > Forecast', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthedForecast(page);
    await page.goto('/chemicals/forecast');
    await page.waitForSelector('.ant-statistic, .ant-spin', { timeout: 15_000 });
  });

  test('loads at the correct URL', async ({ page }) => {
    await expect(page).toHaveURL(/chemicals\/forecast/);
  });

  test('displays summary stat cards', async ({ page }) => {
    const cards = page.locator('.ant-statistic');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(6);
  });

  test('renders the forecast table with all mock rows', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10_000 });
    await expect(page.locator('text=AMS-1525-A').first()).toBeVisible();
    await expect(page.locator('text=MIL-PRF-23827').first()).toBeVisible();
    await expect(page.locator('text=AMS-3276').first()).toBeVisible();
    expect(await page.locator('.ant-table-tbody .ant-table-row').count()).toBe(3);
  });

  test('urgency tags render', async ({ page }) => {
    await expect(page.locator('.ant-tag').first()).toBeVisible();
    expect(await page.locator('.ant-tag').count()).toBeGreaterThan(0);
  });

  test('Needs Attention filter narrows to the critical row', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10_000 });
    await page.locator('button', { hasText: /needs attention/i }).first().click();
    await expect(page.locator('.ant-table-tbody .ant-table-row')).toHaveCount(1);
  });

  test('Expiry Risk filter narrows to the expiry-risk row', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10_000 });
    await page.locator('button', { hasText: /expiry risk/i }).first().click();
    await expect(page.locator('.ant-table-tbody .ant-table-row')).toHaveCount(1);
    await expect(page.locator('text=MIL-PRF-23827').first()).toBeVisible();
  });

  test('All filter restores every row', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody .ant-table-row', { timeout: 10_000 });
    await page.locator('button', { hasText: /needs attention/i }).first().click();
    await expect(page.locator('.ant-table-tbody .ant-table-row')).toHaveCount(1);
    await page.locator('button', { hasText: /^All/i }).first().click();
    await expect(page.locator('.ant-table-tbody .ant-table-row')).toHaveCount(3);
  });

  test('footer shows the analysis window', async ({ page }) => {
    await expect(page.locator('text=/Based on 90-day consumption history/i')).toBeVisible({ timeout: 10_000 });
  });
});
