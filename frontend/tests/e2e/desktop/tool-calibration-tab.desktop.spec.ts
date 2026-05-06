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

    // Tool number appears in the drawer header ("Tool: T200") and again in
    // the Details table — `.first()` keeps strict-mode happy.
    await expect(drawer.getByText(TEST_TOOLS.calibratedWrench.number).first()).toBeVisible();
  });

  /**
   * The Calibration tab's job, restated by the user: "show me the last and
   * next calibration date at minimum, plus how to record a new one." These
   * tests pin down that contract. They use the seeded T200 wrench, which has
   * `requires_calibration=true` plus one ToolCalibration record from the seed
   * (last ~351 days ago, next ~14 days out).
   */
  test('summary card surfaces last/next calibration dates and frequency', async ({ page }) => {
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
    await drawer.getByRole('tab', { name: /calibration/i }).click();

    // The Calibration tab is the only tab that uses antd `Statistic`; the
    // Details tab uses `Descriptions`. So `.ant-statistic` selectors are
    // implicitly scoped to the Calibration tab — no need to filter the
    // tabpanel by visibility (antd 5 hides inactive panes via class +
    // display:none, not aria-hidden, so that filter is unreliable).

    // antd Statistic renders the field name in `.ant-statistic-title`. All
    // five summary fields should appear regardless of history length.
    for (const title of ['Status', 'Frequency', 'Last Calibration', 'Next Calibration', 'Time Until Next']) {
      await expect(
        drawer.locator('.ant-statistic-title', { hasText: new RegExp(`^${title}$`) }).first()
      ).toBeVisible();
    }

    // Frequency for the seeded wrench is 365 days. Match the whole
    // Statistic block by its (unique) title text and assert its content
    // contains 365 — this avoids splitting on antd's value formatting.
    const frequencyCard = drawer.locator('.ant-statistic').filter({ hasText: 'Frequency' }).first();
    await expect(frequencyCard).toContainText('365');

    // The "Time Until Next" stat shows a non-empty days countdown — content
    // depends on the seed date but it must not be the placeholder em-dash.
    const timeUntilCard = drawer.locator('.ant-statistic').filter({ hasText: 'Time Until Next' }).first();
    await expect(timeUntilCard.locator('.ant-statistic-content-value')).not.toHaveText('—');
  });

  test('Record Calibration button opens a modal and persists a new record', async ({ page }) => {
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
    await drawer.getByRole('tab', { name: /calibration/i }).click();

    // Snapshot how many timeline items render before we add a new record.
    const timelineItems = drawer.locator('.ant-timeline-item');
    const initialCount = await timelineItems.count();

    await drawer.getByRole('button', { name: /record calibration/i }).click();

    // The modal renders outside the drawer in the antd Portal — pick it up
    // from the page rather than the drawer.
    const modal = page.locator('.ant-modal').filter({ hasText: /Record Calibration/i }).first();
    await expect(modal).toBeVisible();

    // Date and result come pre-filled (today / pass). Add notes that we can
    // assert against later to disambiguate from seeded records. The Notes
    // textarea is the only TextArea inside the modal — locate it directly
    // rather than rely on accessible-name resolution, which has bitten us
    // when antd label wiring changes between versions.
    const stamp = `e2e-${Date.now()}`;
    await modal.locator('textarea').fill(stamp);

    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          /\/api\/tools\/\d+\/calibrations$/.test(resp.url()) &&
          resp.request().method() === 'POST'
      ),
      modal.getByRole('button', { name: /save calibration/i }).click(),
    ]);

    // If the backend returns a non-2xx, the drawer keeps the modal open and
    // shows a toast. Surface that as a clear failure rather than a generic
    // toBeHidden timeout — past regressions (e.g. tz-aware/naive datetime
    // comparison in `Tool.update_calibration_status`) silently 500'd here.
    expect(
      response.status(),
      `POST /api/tools/.../calibrations returned ${response.status()}: ${await response.text().catch(() => '<no body>')}`
    ).toBeLessThan(300);

    // Modal closes and the new record shows up in the timeline.
    await expect(modal).toBeHidden();
    await expect(drawer.getByText(stamp)).toBeVisible({ timeout: 5_000 });
    await expect(timelineItems).toHaveCount(initialCount + 1);
  });

  test('calibration tab shows enable-tracking empty state for non-calibrated tools', async ({ page }) => {
    // T001 (Digital Multimeter) is seeded without requires_calibration —
    // the tab should explain that and offer an Edit shortcut, not crash.
    const tools = new ToolsPage(page);
    await tools.open();
    await tools.search(TEST_TOOLS.multimeter.number);

    const row = tools.table
      .locator('tr[data-row-key]')
      .filter({ hasText: TEST_TOOLS.multimeter.number })
      .first();
    await row.waitFor({ state: 'visible' });
    await row.locator('[aria-label="eye"]').first().click();

    const drawer = page.locator('.ant-drawer-open, .ant-drawer-content').first();
    const calibrationTab = drawer.getByRole('tab', { name: /calibration/i });
    await expect(calibrationTab).not.toHaveAttribute('aria-disabled', 'true');
    await calibrationTab.click();

    await expect(drawer.getByText(/not currently tracked for calibration/i)).toBeVisible();
    // Scope to the antd Empty container — the drawer header also has an
    // "Edit tool details" button, and the empty-state Edit button's
    // accessible name comes out as "edit Edit Tool" because Playwright
    // includes the EditOutlined icon's `data-icon="edit"`. Filtering inside
    // `.ant-empty` avoids both collisions.
    const emptyState = drawer.locator('.ant-empty').first();
    await expect(emptyState.getByRole('button', { name: /edit tool/i })).toBeVisible();
  });
});
