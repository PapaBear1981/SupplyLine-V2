import { test, expect } from '@playwright/test';

/**
 * Kits dashboard + creation wizard entry.
 *
 * Phase 4 covers the wizard's load path only — the wizard is a multi-step
 * form driven by antd `Steps`, and deep step-by-step automation belongs
 * to a follow-up phase. This spec guards against regressions that would
 * break the kits landing page or the Create-New-Kit route entirely.
 */
test.describe('Kits (desktop)', () => {
  test('kits dashboard renders with its create CTA', async ({ page }) => {
    await page.goto('/kits');
    await expect(page.getByTestId('kits-page')).toBeVisible();
    await expect(page.getByTestId('kits-create-button')).toBeVisible();
  });

  test('Create New Kit navigates to the wizard route', async ({ page }) => {
    await page.goto('/kits');
    await page.getByTestId('kits-create-button').click();
    await expect(page).toHaveURL(/\/kits\/new/);
    // The wizard is built on antd `Steps` — a reliable cross-version
    // marker that survives minor DOM churn.
    await expect(page.locator('.ant-steps').first()).toBeVisible({ timeout: 10_000 });
  });
});
