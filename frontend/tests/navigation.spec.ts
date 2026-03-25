import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Fresh login for each test to avoid session issues
    await page.goto('/login');
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.fill('input[type="text"]', 'ADMIN001');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test('should navigate to Dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should navigate to Tools', async ({ page }) => {
    await page.goto('/tools');
    await page.waitForTimeout(2000);  // Wait for redirect or content
    await expect(page).toHaveURL(/tools/);
  });

  test('should navigate to Chemicals', async ({ page }) => {
    await page.goto('/chemicals');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/chemicals/);
  });

  test('should navigate to Kits', async ({ page }) => {
    await page.goto('/kits');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/kits/);
  });

  test('should navigate to Orders', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/orders/);
  });

  test('should navigate to Requests', async ({ page }) => {
    await page.goto('/requests');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/requests/);
  });

  test('should navigate to Warehouses', async ({ page }) => {
    await page.goto('/warehouses');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/warehouses/);
  });

  test('should navigate to Settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/settings/);
  });
});
