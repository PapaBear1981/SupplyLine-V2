import { test, expect } from '@playwright/test';

/**
 * Master kit lists admin page — relies on the seeded ADMIN001 storage state.
 *
 * Skipped when the backend isn't seeded with master kits. The
 * seed_comprehensive_data.py script creates one MasterKit per aircraft type;
 * if that hasn't run, this spec will be skipped to avoid flakes in CI.
 */
test.describe('Master Kit Lists Admin (desktop)', () => {
  test('admin page renders with a create button and list', async ({ page }) => {
    await page.goto('/admin/master-kits');
    await expect(page.getByTestId('master-kits-admin')).toBeVisible();
    await expect(page.getByTestId('master-kits-create-button')).toBeVisible();
  });

  test('create master kit opens a modal with required fields', async ({ page }) => {
    await page.goto('/admin/master-kits');
    await page.getByTestId('master-kits-create-button').click();
    await expect(page.getByTestId('master-kit-aircraft-type-select')).toBeVisible();
    await expect(page.getByTestId('master-kit-name-input')).toBeVisible();
  });
});
