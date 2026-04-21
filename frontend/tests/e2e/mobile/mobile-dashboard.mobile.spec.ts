import { test, expect } from '@playwright/test';

/**
 * Mobile dashboard — validates that the mobile variant (not the desktop
 * one) renders on a sub-768px viewport, that the primary navigation
 * chrome is mounted, and that the viewport is what we expect.
 */
test.describe('Mobile dashboard', () => {
  test('mobile variant renders on small viewports', async ({ page }) => {
    await page.goto('/dashboard');
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThan(768);
    await expect(page.getByTestId('mobile-dashboard')).toBeVisible({ timeout: 10_000 });
    // Desktop dashboard-page marker should NOT be present.
    await expect(page.getByTestId('dashboard-page')).toHaveCount(0);
  });

  test('welcome block + bottom tab bar are wired up', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('mobile-dashboard-welcome')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-dashboard')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-menu')).toBeVisible();
  });

  test('app shell is marked ready', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });
});
