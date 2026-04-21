import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';

/**
 * Dashboard smoke coverage — validates the shell loads, the stat grid is
 * wired to the seeded backend, and the sidebar nav-* testids are present.
 *
 * Uses the shared storageState written by the `setup` project, so the test
 * boots authenticated against the live Flask backend.
 */
test.describe('Dashboard (desktop)', () => {
  test('renders the dashboard shell and app chrome', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.open();
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    await expect(page.getByTestId('app-shell')).toBeVisible();
  });

  test('primary stat grid renders the four headline tiles', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    for (const slug of [
      'dashboard-stat-inbound-transfers',
      'dashboard-stat-tools-in-maintenance',
      'dashboard-stat-active-kits',
      'dashboard-stat-warehouses',
    ]) {
      await expect(page.getByTestId(slug)).toBeVisible();
    }
  });

  test('sidebar exposes the core nav items', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('nav-tools')).toBeVisible();
    await expect(page.getByTestId('nav-chemicals')).toBeVisible();
  });

  test('clicking nav-tools routes to the Tools page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-tools').click();
    await expect(page).toHaveURL(/\/tools/);
    await expect(page.getByTestId('tools-page')).toBeVisible();
  });
});
