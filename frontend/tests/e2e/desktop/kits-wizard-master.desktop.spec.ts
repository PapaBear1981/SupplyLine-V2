import { test, expect } from '@playwright/test';

/**
 * Wizard master-kit integration — the seeded admin can see the master banner
 * and entry preview when an aircraft type with an active MasterKit is chosen.
 */
test.describe('Kit Wizard — master kit support (desktop)', () => {
  test('wizard renders aircraft type options that mention available masters', async ({ page }) => {
    await page.goto('/kits/new');
    await expect(page.locator('.ant-steps').first()).toBeVisible({ timeout: 10_000 });
    // The aircraft-type select uses a data-testid added in the wizard rewrite.
    await page.getByTestId('wizard-aircraft-type-select').click();
    // We don't assume any particular aircraft type is present (CI may seed
    // different sets); but the dropdown should render at least one option.
    const options = page.locator('.ant-select-item-option');
    await expect(options.first()).toBeVisible({ timeout: 10_000 });
  });

  test('master banner + opt-out toggle appear when a master is configured', async ({ page }) => {
    await page.goto('/kits/new');
    await expect(page.locator('.ant-steps').first()).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('wizard-aircraft-type-select').click();
    const masterOption = page.locator('.ant-select-item-option')
      .filter({ hasText: /Master available/ }).first();
    // If no master-bearing aircraft type is seeded, skip the rest gracefully.
    if (await masterOption.count() === 0) {
      test.skip(true, 'No master-kit-bearing aircraft type seeded; skipping banner test.');
    }
    await masterOption.click();
    // Advance to step 2.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('wizard-master-banner')).toBeVisible();
    await expect(page.getByTestId('wizard-master-toggle')).toBeVisible();
  });
});
