import { test, expect } from '@playwright/test';
import { ChemicalsPage } from '../../pages/desktop/ChemicalsPage';
import { TEST_CHEMICALS } from '../../fixtures/test-data';

/**
 * Chemicals list page — mirrors the tools spec pattern. Relies on the
 * seeded chemicals in `backend/seed_e2e_test_data.py` (CHEM001/CHEM002).
 */
test.describe('Chemicals (desktop)', () => {
  test('loads the chemicals page with its controls', async ({ page }) => {
    const chemicals = new ChemicalsPage(page);
    await chemicals.open();
    await expect(chemicals.root).toBeVisible();
    await expect(chemicals.searchInput).toBeVisible();
    await expect(chemicals.createButton).toBeVisible();
    await expect(chemicals.table).toBeVisible();
  });

  test('renders seeded chemical rows', async ({ page }) => {
    const chemicals = new ChemicalsPage(page);
    await chemicals.open();
    await chemicals.table.locator('tr[data-row-key]').first().waitFor({ state: 'visible' });
    await expect(page.locator(`text=${TEST_CHEMICALS.solvent.partNumber}`).first()).toBeVisible();
    await expect(page.locator(`text=${TEST_CHEMICALS.lubricant.partNumber}`).first()).toBeVisible();
  });

  test('search narrows to the queried part number', async ({ page }) => {
    const chemicals = new ChemicalsPage(page);
    await chemicals.open();
    await chemicals.table.locator('tr[data-row-key]').first().waitFor({ state: 'visible' });
    await chemicals.search(TEST_CHEMICALS.solvent.partNumber);
    await expect(page.locator(`text=${TEST_CHEMICALS.solvent.partNumber}`).first()).toBeVisible();
  });

  test('create button opens the chemical drawer', async ({ page }) => {
    const chemicals = new ChemicalsPage(page);
    await chemicals.open();
    await chemicals.createButton.click();
    await expect(page.locator('.ant-drawer-open, .ant-drawer-content').first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
