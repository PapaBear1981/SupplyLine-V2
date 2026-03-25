import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="text"], input[id="employee_number"]', { timeout: 10000 });
    await page.fill('input[type="text"], input[id="employee_number"]', 'ADMIN001');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    await page.goto('/settings');
    await page.waitForTimeout(2000);
  });

  test('should load settings page', async ({ page }) => {
    await expect(page).toHaveURL(/settings/);
  });

  test('should display settings content', async ({ page }) => {
    await page.waitForSelector('.ant-card, .ant-form, .ant-empty', { timeout: 15000 });
    const content = page.locator('.ant-card, .ant-form, .ant-empty');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });
});
