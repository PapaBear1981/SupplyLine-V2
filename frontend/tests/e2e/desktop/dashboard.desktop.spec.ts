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

  test('clicking nav-tools opens the Tools submenu and Inventory routes to the Tools page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-tools').click();
    await page.getByTestId('nav-tools-inventory').click();
    await expect(page).toHaveURL(/\/tools/);
    await expect(page.getByTestId('tools-page')).toBeVisible();
  });

  test('sidebar exposes the Operations group', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('nav-operations')).toBeVisible();
  });

  test('clicking nav-operations expands the submenu with Fulfillment, Requests, and Transfers', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-operations').click();
    await expect(page.getByTestId('nav-orders')).toBeVisible();
    await expect(page.getByTestId('nav-requests')).toBeVisible();
    await expect(page.getByTestId('nav-transfers')).toBeVisible();
  });

  test('Operations → Fulfillment routes to /orders', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-operations').click();
    await page.getByTestId('nav-orders').click();
    await expect(page).toHaveURL(/\/orders/);
    await expect(page.getByTestId('orders-page')).toBeVisible();
  });

  test('Operations → Requests routes to /requests', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-operations').click();
    await page.getByTestId('nav-requests').click();
    await expect(page).toHaveURL(/\/requests/);
    await expect(page.getByTestId('requests-page')).toBeVisible();
  });

  test('Operations → Transfers routes to /transfers', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-operations').click();
    await page.getByTestId('nav-transfers').click();
    await expect(page).toHaveURL(/\/transfers/);
    await expect(page.getByTestId('transfers-page')).toBeVisible();
  });
});
