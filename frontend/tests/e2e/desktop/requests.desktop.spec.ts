import { test, expect } from '@playwright/test';

/**
 * Requests dashboard smoke coverage.
 */
test.describe('Requests (desktop)', () => {
  test('requests dashboard renders with its create CTA', async ({ page }) => {
    await page.goto('/requests');
    await expect(page.getByTestId('requests-page')).toBeVisible();
    await expect(page.getByTestId('requests-create-button')).toBeVisible();
  });

  test('sidebar auto-expands the Operations group when landing on the requests page', async ({ page }) => {
    await page.goto('/requests');
    await expect(page.getByTestId('nav-operations')).toBeVisible();
    await expect(page.getByTestId('nav-requests')).toBeVisible();
  });

  test('New Request navigates to the create form route', async ({ page }) => {
    await page.goto('/requests');
    await page.getByTestId('requests-create-button').click();
    await expect(page).toHaveURL(/\/requests\/new/);
  });
});
