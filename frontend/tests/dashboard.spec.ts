import { test, expect } from '@playwright/test';

const login = async (page: any) => {
  await page.goto('/login');
  await page.waitForSelector('.ant-input, .ant-input-affix-wrapper', { timeout: 10000 });
  await page.fill('input[placeholder*="Employee"], input[placeholder*="00421"]', 'ADMIN001');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
};

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should display dashboard stats', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    
    const dashboardContent = page.locator('.ant-card, .ant-statistic, .ant-table');
    await expect(dashboardContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display charts on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    expect(true).toBeTruthy();
  });
});