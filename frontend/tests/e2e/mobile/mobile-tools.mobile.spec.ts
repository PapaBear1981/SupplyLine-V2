import { test, expect } from '@playwright/test';
import { MobileToolsPage } from '../../pages/mobile/MobileToolsPage';

/**
 * Mobile tools list — validates the antd-mobile variant renders when
 * `ToolsPage` detects a mobile viewport, and its core controls are
 * present (search bar, filter button, create FAB).
 *
 * Drives the live seeded backend via the shared authenticated
 * storageState; tool items appear by id (T001..T005 map to database ids 1..5).
 */
test.describe('Mobile tools list', () => {
  test('mobile variant renders with search + filter chrome', async ({ page }) => {
    const tools = new MobileToolsPage(page);
    await tools.open();
    await expect(tools.root).toBeVisible();
    await expect(tools.searchBar).toBeVisible();
    await expect(tools.filterButton).toBeVisible();
    await expect(tools.createButton).toBeVisible();
  });

  test('seeded tool appears in the list', async ({ page }) => {
    const tools = new MobileToolsPage(page);
    await tools.open();
    // Wait for at least one mobile tool item to render; any of the seeded
    // tool IDs (1..5) will do.
    await expect(page.locator('[data-testid^="mobile-tool-item-"]').first()).toBeVisible({
      timeout: 10_000,
    });
    // Look for a seeded tool number by content.
    await expect(page.locator('text=T001').first()).toBeVisible();
  });

  test('create FAB opens the tool form popup', async ({ page }) => {
    const tools = new MobileToolsPage(page);
    await tools.open();
    await tools.createButton.click();
    // antd-mobile Popup renders a .adm-popup-body element.
    await expect(page.locator('.adm-popup-body').first()).toBeVisible({ timeout: 5_000 });
  });
});
