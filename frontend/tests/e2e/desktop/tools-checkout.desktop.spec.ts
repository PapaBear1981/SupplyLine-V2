import { test, expect } from '@playwright/test';
import { ToolCheckoutPage } from '../../pages/desktop/ToolCheckoutPage';

/**
 * Tool-Checkout page smoke coverage — validates the page loads, stat cards
 * render (via antd `Statistic`), and the Quick Checkout modal opens.
 *
 * Intentionally stops short of driving a full checkout transaction against
 * the live backend; that deeper flow is covered by Phase 4's kits/orders
 * specs where the mutating endpoints have dedicated fixtures.
 */
test.describe('Tool Checkout (desktop)', () => {
  test('loads the checkout page with primary controls', async ({ page }) => {
    const checkout = new ToolCheckoutPage(page);
    await checkout.open();
    await expect(checkout.root).toBeVisible();
    await expect(checkout.createButton).toBeVisible();
  });

  test('stat cards render via antd Statistic', async ({ page }) => {
    const checkout = new ToolCheckoutPage(page);
    await checkout.open();
    // Four stat cards: Active, Overdue, Today's Checkouts, Today's Returns.
    await expect(page.locator('.ant-statistic').first()).toBeVisible();
    expect(await page.locator('.ant-statistic').count()).toBeGreaterThanOrEqual(4);
  });

  test('Checkout button opens the quick-checkout modal', async ({ page }) => {
    const checkout = new ToolCheckoutPage(page);
    await checkout.open();
    await checkout.createButton.click();
    await expect(page.locator('.ant-modal').first()).toBeVisible({ timeout: 5_000 });
  });
});
