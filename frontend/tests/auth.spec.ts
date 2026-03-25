import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('.ant-input, .ant-input-affix-wrapper', { timeout: 10000 });
    
    await expect(page.locator('input[placeholder*="Employee"], input[placeholder*="00421"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should fail login with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('.ant-input, .ant-input-affix-wrapper', { timeout: 10000 });
    
    await page.fill('input[placeholder*="Employee"], input[placeholder*="00421"]', 'INVALID');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait a bit for error to appear - look for any error indication
    await page.waitForTimeout(2000);
    
    // Check for error - either message or staying on login page
    const url = page.url();
    expect(url).toContain('login');
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('.ant-input, .ant-input-affix-wrapper', { timeout: 10000 });
    
    await page.fill('input[placeholder*="Employee"], input[placeholder*="00421"]', 'ADMIN001');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForTimeout(3000);
    
    const url = page.url();
    console.log('After login URL:', url);
    expect(url).toMatch(/dashboard|totp|verification/);
  });
});