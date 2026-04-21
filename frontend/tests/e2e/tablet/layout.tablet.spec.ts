import { test, expect } from '@playwright/test';

/**
 * iPad Pro 11 sanity — at this viewport (≥ 768) `useIsMobile()` returns
 * false, so the desktop `MainLayout` should render instead of
 * `MobileLayout`. This spec guards against responsive breakpoint
 * regressions (e.g. someone bumping MOBILE_BREAKPOINT above 834).
 */
test.describe('Tablet layout', () => {
  test('tablet viewport renders the desktop shell, not the mobile one', async ({ page }) => {
    await page.goto('/dashboard');
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeGreaterThanOrEqual(768);
    await expect(page.getByTestId('app-shell')).toBeVisible();
    // Mobile dashboard marker must NOT be present on tablet.
    await expect(page.getByTestId('mobile-dashboard')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10_000 });
  });

  test('desktop sidebar nav is present on tablet', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('nav-tools')).toBeVisible();
    await expect(page.getByTestId('nav-chemicals')).toBeVisible();
  });
});
