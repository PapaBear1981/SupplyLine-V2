import { test, expect } from '@playwright/test';
import { ToolsPage } from '../../pages/desktop/ToolsPage';
import { TEST_TOOLS } from '../../fixtures/test-data';

/**
 * Regression: opening the details drawer for a torque wrench that requires
 * calibration crashed the drawer to a blank screen with
 * `Uncaught TypeError: w.map is not a function`. Root cause was a shape
 * mismatch — `/api/tools/{id}/calibrations` returns
 * `{ calibrations, pagination }` but the frontend RTK Query endpoint typed
 * it as a bare array and called `.map()` on the envelope object.
 *
 * These tests open the details drawer for the seeded calibrated wrench
 * (T200), switch to the Calibration tab, and assert:
 *   1. No uncaught page errors fire — specifically not `.map is not a
 *      function`, which would mean the response transform regressed.
 *   2. The calibration timeline actually renders content from the seeded
 *      ToolCalibration record, proving the data made it through.
 */
test.describe('Tool details — calibration tab (desktop)', () => {
  test('opens the calibration tab for a wrench without crashing', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    const tools = new ToolsPage(page);
    await tools.open();
    await tools.search(TEST_TOOLS.calibratedWrench.number);

    const row = tools.table
      .locator('tr[data-row-key]')
      .filter({ hasText: TEST_TOOLS.calibratedWrench.number })
      .first();
    await row.waitFor({ state: 'visible' });
    await row.locator('[aria-label="eye"]').first().click();

    const drawer = page.locator('.ant-drawer-open, .ant-drawer-content').first();
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Switch to Calibration tab — this is exactly the path that crashed.
    const calibrationTab = drawer.getByRole('tab', { name: /calibration/i });
    await expect(calibrationTab).toBeVisible();
    await expect(calibrationTab).not.toHaveAttribute('aria-disabled', 'true');
    await calibrationTab.click();

    // antd Timeline renders one .ant-timeline-item per calibration record.
    const timelineItem = drawer.locator('.ant-timeline-item').first();
    await expect(timelineItem).toBeVisible({ timeout: 5_000 });
    // The seeded record's calibration_status is "pass" — its tag must render.
    await expect(timelineItem.getByText(/pass/i).first()).toBeVisible();

    const mapErrors = errors.filter((e) => /map is not a function/i.test(e.message));
    expect(
      mapErrors,
      `Calibration tab raised "${mapErrors.map((e) => e.message).join('; ')}" — ` +
        `the /api/tools/{id}/calibrations response transform likely regressed.`
    ).toEqual([]);
  });

  test('drawer stays interactive after switching tabs', async ({ page }) => {
    const tools = new ToolsPage(page);
    await tools.open();
    await tools.search(TEST_TOOLS.calibratedWrench.number);

    const row = tools.table
      .locator('tr[data-row-key]')
      .filter({ hasText: TEST_TOOLS.calibratedWrench.number })
      .first();
    await row.waitFor({ state: 'visible' });
    await row.locator('[aria-label="eye"]').first().click();

    const drawer = page.locator('.ant-drawer-open, .ant-drawer-content').first();
    await expect(drawer).toBeVisible();

    // Click Calibration then back to Details. A render-time exception in the
    // calibration tab would unmount the Tabs entirely, so the Details click
    // would fail.
    await drawer.getByRole('tab', { name: /calibration/i }).click();
    await drawer.getByRole('tab', { name: /details/i }).click();

    await expect(drawer.getByText(TEST_TOOLS.calibratedWrench.number)).toBeVisible();
  });
});
