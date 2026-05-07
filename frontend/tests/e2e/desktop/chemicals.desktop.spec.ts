import { test, expect } from '@playwright/test';
import { ChemicalsPage } from '../../pages/desktop/ChemicalsPage';
import { TEST_CHEMICALS } from '../../fixtures/test-data';

/**
 * Chemicals list page — relies on seeded chemicals in
 * `backend/seed_e2e_test_data.py` (CHEM001/CHEM002). The page now defaults
 * to a part-number rollup view; lots show up after expanding a row or
 * after switching to the "By Lot" view via the segmented toggle.
 */
test.describe('Chemicals (desktop)', () => {
  test('loads the chemicals page with its controls', async ({ page }) => {
    const chemicals = new ChemicalsPage(page);
    await chemicals.open();
    await expect(chemicals.root).toBeVisible();
    await expect(chemicals.searchInput).toBeVisible();
    await expect(chemicals.createButton).toBeVisible();
    await expect(chemicals.viewToggle).toBeVisible();
    await expect(chemicals.table).toBeVisible();
  });

  test('renders seeded chemical part numbers in the parts view', async ({ page }) => {
    const chemicals = new ChemicalsPage(page);
    await chemicals.open();
    await chemicals.table.locator('tr[data-row-key]').first().waitFor({ state: 'visible' });
    await expect(page.locator(`text=${TEST_CHEMICALS.solvent.partNumber}`).first()).toBeVisible();
    await expect(page.locator(`text=${TEST_CHEMICALS.lubricant.partNumber}`).first()).toBeVisible();
  });

  test('search narrows the parts view to the queried part number', async ({ page }) => {
    const chemicals = new ChemicalsPage(page);
    await chemicals.open();
    await chemicals.table.locator('tr[data-row-key]').first().waitFor({ state: 'visible' });
    await chemicals.search(TEST_CHEMICALS.solvent.partNumber);
    await expect(page.locator(`text=${TEST_CHEMICALS.solvent.partNumber}`).first()).toBeVisible();
  });

  test('view toggle switches to the legacy lot-level view', async ({ page }) => {
    const chemicals = new ChemicalsPage(page);
    await chemicals.open();
    await chemicals.switchToLotView();
    await expect(chemicals.lotTable).toBeVisible();
    await expect(chemicals.lotSearchInput).toBeVisible();
    // Seeded lots show up as individual rows in this view
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
