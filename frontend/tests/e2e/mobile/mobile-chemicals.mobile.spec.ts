import { test, expect } from '@playwright/test';
import { MobileChemicalsPage } from '../../pages/mobile/MobileChemicalsPage';

/**
 * Mobile chemicals list — validates the antd-mobile variant renders when
 * `ChemicalsPage` detects a mobile viewport, and that the chemical issuance
 * flow allows users to search for and select a recipient.
 *
 * Drives the live seeded backend via the shared authenticated storageState.
 */
test.describe('Mobile chemicals list', () => {
  test('mobile variant renders with search chrome', async ({ page }) => {
    const chemicals = new MobileChemicalsPage(page);
    await chemicals.open();
    await expect(chemicals.root).toBeVisible();
    // SearchBar and filter button from the mobile list chrome
    await expect(page.locator('.adm-search-bar').first()).toBeVisible();
  });

  test('seeded chemical appears in the list', async ({ page }) => {
    const chemicals = new MobileChemicalsPage(page);
    await chemicals.open();
    await expect(page.locator('text=CHEM001').first()).toBeVisible({ timeout: 10_000 });
  });

  test('issue chemical button opens the issuance form', async ({ page }) => {
    const chemicals = new MobileChemicalsPage(page);
    await chemicals.open();
    await chemicals.openChemicalDetail('CHEM001');
    await chemicals.clickIssueChemical();
    await expect(chemicals.issuanceForm).toBeVisible();
  });

  test('user trigger opens the user selection popup with search', async ({ page }) => {
    const chemicals = new MobileChemicalsPage(page);
    await chemicals.open();
    await chemicals.openChemicalDetail('CHEM001');
    await chemicals.clickIssueChemical();

    // Tap the "Issue To" trigger — should open the user selection popup
    await chemicals.userTrigger.click();
    await expect(chemicals.userSearch).toBeVisible({ timeout: 5_000 });
  });

  test('user selection popup lists users and supports search', async ({ page }) => {
    const chemicals = new MobileChemicalsPage(page);
    await chemicals.open();
    await chemicals.openChemicalDetail('CHEM001');
    await chemicals.clickIssueChemical();
    await chemicals.userTrigger.click();
    await expect(chemicals.userSearch).toBeVisible({ timeout: 5_000 });

    // Seeded users should appear in the list
    await expect(page.locator('text=John Engineer').first()).toBeVisible({ timeout: 5_000 });

    // Typing in the search input filters the list
    await chemicals.userSearch.locator('input').fill('John');
    await expect(page.locator('text=John Engineer').first()).toBeVisible();
    // Users that don't match should not appear
    await expect(page.locator('text=Regular User').first()).not.toBeVisible();
  });

  test('selecting a user from the popup populates the Issue To field', async ({ page }) => {
    const chemicals = new MobileChemicalsPage(page);
    await chemicals.open();
    await chemicals.openChemicalDetail('CHEM001');
    await chemicals.clickIssueChemical();
    await chemicals.userTrigger.click();
    await expect(chemicals.userSearch).toBeVisible({ timeout: 5_000 });

    // Clear the search and pick the first available user by clicking their name
    const userItem = page.locator('text=John Engineer').first();
    await expect(userItem).toBeVisible({ timeout: 5_000 });
    await userItem.click();

    // Popup should close after selection
    await expect(chemicals.userSearch).not.toBeVisible({ timeout: 3_000 });

    // The trigger input should now show the selected user's name
    await expect(chemicals.userTrigger).toContainText('John Engineer');
  });
});
