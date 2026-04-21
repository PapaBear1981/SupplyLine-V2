import { test, expect } from '@playwright/test';

/**
 * Theme persistence — clicks the dark-mode card on the Settings page and
 * asserts that the `ThemeContext` wrote the mode into the
 * `supplyline-theme-config` localStorage key (see
 * `frontend/src/features/settings/contexts/ThemeContext.tsx`). A page
 * reload should pick up the same preference.
 *
 * Desktop-only: the mobile Settings page swaps the light/dark cards for
 * an antd-mobile Switch with different testid semantics. A dedicated
 * mobile theme spec can follow in a later iteration.
 */
const STORAGE_KEY = 'supplyline-theme-config';

test.describe('Theme persistence (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByTestId('settings-page')).toBeVisible();
    // Normalize to a known baseline so the assertions below are stable
    // regardless of a prior test's residue in storageState.
    await page.getByTestId('theme-mode-light').click();
    await page.waitForFunction(
      (key) => JSON.parse(window.localStorage.getItem(key) || '{}')?.mode === 'light',
      STORAGE_KEY,
      { timeout: 5_000 },
    );
  });

  test('dark mode selection persists to localStorage', async ({ page }) => {
    await page.getByTestId('theme-mode-dark').click();
    await page.waitForFunction(
      (key) => JSON.parse(window.localStorage.getItem(key) || '{}')?.mode === 'dark',
      STORAGE_KEY,
      { timeout: 5_000 },
    );
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toContain('"mode":"dark"');
  });

  test('theme mode survives a full reload', async ({ page }) => {
    await page.getByTestId('theme-mode-dark').click();
    await page.waitForFunction(
      (key) => JSON.parse(window.localStorage.getItem(key) || '{}')?.mode === 'dark',
      STORAGE_KEY,
    );
    await page.reload();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    const after = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(after).toContain('"mode":"dark"');
  });
});
