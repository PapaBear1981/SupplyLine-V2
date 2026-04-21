import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

export class ChemicalsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get root(): Locator {
    return this.page.getByTestId('chemicals-page');
  }

  get searchInput(): Locator {
    return this.page.getByTestId('chemicals-search-input');
  }

  get createButton(): Locator {
    return this.page.getByTestId('chemicals-create-button');
  }

  get table(): Locator {
    return this.page.getByTestId('chemicals-table');
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
