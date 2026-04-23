import { test, expect } from '@playwright/test';
import { MobileToolsPage } from '../../pages/mobile/MobileToolsPage';

/**
 * Mobile tool history tests — validates that:
 * 1. The /tool-history route renders the mobile audit history page.
 * 2. The History and Calibration tabs appear in the tool detail popup.
 *
 * Runs against the live backend seeded by seed_e2e_test_data.py.
 */
test.describe('Mobile tool history', () => {
  test('mobile audit history page loads at /tool-history', async ({ page }) => {
    await page.goto('/tool-history');
    // MobileToolAuditHistory renders with data-testid="mobile-tool-audit-history-page"
    await expect(
      page.getByTestId('mobile-tool-audit-history-page')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('mobile audit history page shows the search bar and filter button', async ({ page }) => {
    await page.goto('/tool-history');
    await page.getByTestId('mobile-tool-audit-history-page').waitFor({ state: 'visible' });
    await expect(page.getByTestId('mobile-audit-history-search')).toBeVisible();
    await expect(page.getByTestId('mobile-audit-history-filter-button')).toBeVisible();
  });

  test('mobile audit history list renders', async ({ page }) => {
    await page.goto('/tool-history');
    await page.getByTestId('mobile-tool-audit-history-page').waitFor({ state: 'visible' });
    // Wait for the loading state to resolve: either the list or an empty-state appears.
    // waitForSelector avoids the strict-mode issue with multiple .adm-skeleton elements.
    await page.waitForSelector(
      '[data-testid="mobile-audit-history-list"], .adm-empty',
      { timeout: 12_000 }
    );
    const hasList = await page.getByTestId('mobile-audit-history-list').isVisible().catch(() => false);
    const hasEmpty = await page.locator('.adm-empty').first().isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBe(true);
  });

  test('tool detail popup shows History and Calibration tabs', async ({ page }) => {
    const tools = new MobileToolsPage(page);
    await tools.open();
    // Wait for seeded tool T001
    await page.locator('[data-testid^="mobile-tool-item-"]').first().waitFor({ state: 'visible', timeout: 10_000 });
    // Tap the first tool to open the detail popup
    await page.locator('[data-testid^="mobile-tool-item-"]').first().click();
    // The detail popup must appear
    await expect(tools.detailPopup).toBeVisible({ timeout: 5_000 });
    // Verify the three tab titles are present
    await expect(tools.detailPopup.getByText('Details')).toBeVisible();
    await expect(tools.detailPopup.getByText('History')).toBeVisible();
    await expect(tools.detailPopup.getByText('Calibration')).toBeVisible();
  });

  test('History tab inside tool detail popup is interactive', async ({ page }) => {
    const tools = new MobileToolsPage(page);
    await tools.open();
    await page.locator('[data-testid^="mobile-tool-item-"]').first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('[data-testid^="mobile-tool-item-"]').first().click();
    await tools.detailPopup.waitFor({ state: 'visible' });
    // Tap the History tab
    await tools.detailPopup.getByText('History').click();
    // Wait for the tab content to render — list, empty state, or loading skeleton.
    // Use :visible to skip the Details tab's hidden list (inactive tab panels are
    // kept in the DOM but hidden by antd-mobile).
    await expect(
      tools.detailPopup.locator('.adm-list:visible, .adm-empty:visible, .adm-skeleton:visible').first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
