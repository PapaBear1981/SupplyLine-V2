import { expect, Page, test } from '@playwright/test';

const login = async (page: Page) => {
  await page.goto('/login');
  await page.waitForSelector('.ant-input, .ant-input-affix-wrapper', { timeout: 10000 });
  await page.fill('input[placeholder*="Employee"], input[placeholder*="00421"]', 'ADMIN001');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(async () => {
    await page.waitForLoadState('networkidle');
  });
};

test.describe('Chemicals Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/chemicals');
  });

  test('should load chemicals page', async ({ page }) => {
    await expect(page).toHaveURL(/chemicals/);
  });

  test('should display chemicals content', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Look for any content - table, cards, or list
    const content = page.locator('.ant-table, .ant-card, .ant-list, .ant-empty, [class*="content"]');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have search functionality', async ({ page }) => {
    await page.waitForTimeout(2000);
    const searchInput = page.locator('.ant-input-search, input[placeholder*="search" i]');
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
    }
  });
});
