import { test, expect } from '@playwright/test';
import { MobileNavigation } from '../../pages/mobile/MobileNavigation';

/**
 * Mobile navigation — TabBar + "more" menu bottom sheet.
 *
 * Uses the shared authenticated storageState so we can land directly on
 * the dashboard and exercise the TabBar without logging in.
 */
test.describe('Mobile navigation', () => {
  test('bottom tab bar exposes the four primary tabs', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = new MobileNavigation(page);
    await expect(nav.tabDashboard).toBeVisible();
    await expect(nav.tabMenu).toBeVisible();
    await expect(nav.tabProfile).toBeVisible();
    await expect(nav.tabSettings).toBeVisible();
  });

  test('tapping the Menu tab opens the navigation sheet', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = new MobileNavigation(page);
    await nav.openMenu();
    await expect(nav.menuPopup).toBeVisible();
    await expect(nav.logoutItem).toBeVisible();
  });

  test('menu sheet exposes the Tools item and routes there on tap', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = new MobileNavigation(page);
    await nav.openMenu();
    await expect(nav.menuItem('tools')).toBeVisible();
    await nav.menuItem('tools').click();
    await expect(page).toHaveURL(/\/tools/);
    // The mobile tools list should render on a mobile viewport.
    await expect(page.getByTestId('mobile-tools-list')).toBeVisible({ timeout: 10_000 });
  });

  test('menu sheet exposes the Transfers item and routes there on tap', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = new MobileNavigation(page);
    await nav.openMenu();
    await expect(nav.menuItem('transfers')).toBeVisible();
    await nav.menuItem('transfers').click();
    await expect(page).toHaveURL(/\/transfers/);
    await expect(page.getByTestId('transfers-page')).toBeVisible({ timeout: 10_000 });
  });

  test('Settings tab routes to /settings', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = new MobileNavigation(page);
    await nav.tabSettings.click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('Profile tab routes to /profile', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = new MobileNavigation(page);
    await nav.tabProfile.click();
    await expect(page).toHaveURL(/\/profile/);
  });
});
