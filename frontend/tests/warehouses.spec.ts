import { test, expect } from '@playwright/test';

test.describe('Warehouses Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="text"], input[id="employee_number"]', { timeout: 10000 });
    await page.fill('input[type="text"], input[id="employee_number"]', 'ADMIN001');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    await page.goto('/warehouses');
    await page.waitForTimeout(2000);
  });

  test('should load warehouses page', async ({ page }) => {
    await expect(page).toHaveURL(/warehouses/);
  });

  test('should display warehouses content', async ({ page }) => {
    await page.waitForSelector('.ant-table, .ant-card, .ant-list, .ant-empty', { timeout: 15000 });
    const content = page.locator('.ant-table, .ant-card, .ant-list, .ant-empty');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });
});
