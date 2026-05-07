import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * The Chemicals page now defaults to the part-number rollup view, which
 * groups lots under their part_number with expandable detail rows. The
 * legacy flat lot list is still available via the "By Lot" view toggle.
 */
export class ChemicalsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get root(): Locator {
    return this.page.getByTestId('chemicals-page');
  }

  get viewToggle(): Locator {
    return this.page.getByTestId('chemicals-view-toggle');
  }

  // Default (parts) view locators
  get searchInput(): Locator {
    return this.page.getByTestId('chemical-parts-search-input');
  }

  get table(): Locator {
    return this.page.getByTestId('chemical-parts-table');
  }

  // Legacy lot-level view locators — only valid after switching to "By Lot"
  get lotSearchInput(): Locator {
    return this.page.getByTestId('chemicals-search-input');
  }

  get lotTable(): Locator {
    return this.page.getByTestId('chemicals-table');
  }

  get createButton(): Locator {
    return this.page.getByTestId('chemicals-create-button');
  }

  async switchToLotView(): Promise<void> {
    await this.viewToggle.getByText('By Lot').click();
    await this.lotTable.waitFor({ state: 'visible' });
  }

  async switchToPartsView(): Promise<void> {
    await this.viewToggle.getByText('By Part Number').click();
    await this.table.waitFor({ state: 'visible' });
  }

  row(chemicalId: string | number): Locator {
    return this.table.locator(`tr[data-row-key="${chemicalId}"]`);
  }

  async open(): Promise<void> {
    await this.goto('/chemicals');
    await this.root.waitFor({ state: 'visible' });
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
  }
}
