import { test, expect } from '@playwright/test';

test.describe('Mobile smoke coverage', () => {
  test('navigates core mobile routes and opens mobile-specific forms/details', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'ADMIN001');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });

    // Mobile tab bar and popup menu should be visible
    await expect(page.getByText('Menu')).toBeVisible();
    await page.getByText('Menu').first().click();

    // Navigate to Orders from mobile menu
    await page.getByText('Fulfillment').first().click();
    await page.waitForURL('**/orders', { timeout: 10000 });
    await expect(page.getByPlaceholder('Search orders...')).toBeVisible();

    // Open order creation form
    await page.locator('.adm-floating-bubble').first().click();
    await page.waitForURL('**/orders/new', { timeout: 10000 });
    await expect(page.getByText('Create Fulfillment Record')).toBeVisible();

    // Jump to requests and create flow
    await page.goto('/requests');
    await expect(page.getByPlaceholder('Search requests...')).toBeVisible();
    await page.locator('.adm-floating-bubble').first().click();
    await page.waitForURL('**/requests/new', { timeout: 10000 });
    await expect(page.getByText('Create New Request')).toBeVisible();

    // Mobile users page should render search controls
    await page.goto('/users');
    await expect(page.getByPlaceholder('Search users')).toBeVisible();
  });
});
