import { test, expect } from '@playwright/test';
import { ToolsPage } from '../../pages/desktop/ToolsPage';
import { TEST_TOOLS } from '../../fixtures/test-data';

/**
 * Tools list page — exercises the core controls exposed by the P2 testid
 * batch: page wrapper, search, create button, table, and row targeting via
 * the seeded tool numbers.
 *
 * Runs against the live backend seeded by `seed_e2e_test_data.py`.
 */
test.describe('Tools (desktop)', () => {
  test('loads the tools page with its controls', async ({ page }) => {
    const tools = new ToolsPage(page);
    await tools.open();
    await expect(tools.root).toBeVisible();
    await expect(tools.searchInput).toBeVisible();
    await expect(tools.createButton).toBeVisible();
    await expect(tools.table).toBeVisible();
  });

  test('renders seeded tool rows', async ({ page }) => {
    const tools = new ToolsPage(page);
    await tools.open();
    // Wait for at least one row to render before asserting contents.
    await tools.table.locator('tr[data-row-key]').first().waitFor({ state: 'visible' });
    await expect(page.locator(`text=${TEST_TOOLS.multimeter.number}`).first()).toBeVisible();
    await expect(page.locator(`text=${TEST_TOOLS.torqueWrench.number}`).first()).toBeVisible();
  });

  test('search filters the rendered rows', async ({ page }) => {
    const tools = new ToolsPage(page);
    await tools.open();
    await tools.table.locator('tr[data-row-key]').first().waitFor({ state: 'visible' });
    await tools.search(TEST_TOOLS.multimeter.number);
    // After search, the multimeter row should still be visible.
    await expect(page.locator(`text=${TEST_TOOLS.multimeter.number}`).first()).toBeVisible();
  });

  test('create button opens the tool drawer', async ({ page }) => {
    const tools = new ToolsPage(page);
    await tools.open();
    await tools.createButton.click();
    // ToolDrawer is an antd Drawer — assert its content is visible.
    await expect(page.locator('.ant-drawer-open, .ant-drawer-content').first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
