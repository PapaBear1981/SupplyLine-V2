import { test, expect } from '@playwright/test';
import { ToolHistoryPage } from '../../pages/desktop/ToolHistoryPage';
import { ToolsPage } from '../../pages/desktop/ToolsPage';

/**
 * Tool Audit History page smoke tests — validates the page loads, the audit
 * table renders, the event-type filter control is present, and the History
 * tab appears in the ToolDrawer when a tool row is clicked.
 *
 * These tests run against the live backend seeded by seed_e2e_test_data.py.
 */
test.describe('Tool History (desktop)', () => {
  test('audit history page loads with the table', async ({ page }) => {
    const history = new ToolHistoryPage(page);
    await history.open();
    await expect(history.root).toBeVisible();
    await expect(history.table).toBeVisible();
  });

  test('page shows the "Tool Audit History" heading', async ({ page }) => {
    const history = new ToolHistoryPage(page);
    await history.open();
    await expect(page.getByText('Tool Audit History')).toBeVisible();
  });

  test('event type filter select control is present', async ({ page }) => {
    const history = new ToolHistoryPage(page);
    await history.open();
    // Verify the Select dropdown is rendered (antd Select renders as .ant-select)
    await expect(history.root.locator('.ant-select').first()).toBeVisible();
  });

  test('table renders at least a header row', async ({ page }) => {
    const history = new ToolHistoryPage(page);
    await history.open();
    // antd Table always renders thead with column headers
    await expect(history.table.locator('thead')).toBeVisible();
  });

  test('nav link to Tool History is visible in sidebar', async ({ page }) => {
    const history = new ToolHistoryPage(page);
    await history.open();
    // After navigating the sidebar should render the active item
    await expect(page.getByTestId('nav-tool-history')).toBeVisible();
  });

  test('tool drawer shows a History tab when a tool row is opened', async ({ page }) => {
    const tools = new ToolsPage(page);
    await tools.open();
    // Wait for at least one tool row to appear
    await tools.table.locator('tr[data-row-key]').first().waitFor({ state: 'visible' });
    // Click the "View Details" (eye) button. The actions column is fixed-right so the
    // buttons live in the fixed column overlay, not the main tr. Use the icon aria-label.
    await page.locator('[aria-label="eye"]').first().click();

    // The drawer should open
    const drawer = page.locator('.ant-drawer-open, .ant-drawer-content').first();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // A "History" tab must be present inside the drawer
    await expect(drawer.getByRole('tab', { name: /history/i })).toBeVisible({ timeout: 5_000 });
  });
});
