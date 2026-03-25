import { test, expect } from '@playwright/test';

test.describe('Tools Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.waitForSelector('input[type="text"], input[id="employee_number"]', { timeout: 10000 });
    await page.fill('input[type="text"], input[id="employee_number"]', 'ADMIN001');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Navigate to tools
    await page.goto('/tools');
    await page.waitForTimeout(2000);
  });

  test('should load tools page', async ({ page }) => {
    await expect(page).toHaveURL(/tools/);
  });

  test('should display tools content', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('.ant-table', { timeout: 15000 });
    const content = page.locator('.ant-table');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });
});
