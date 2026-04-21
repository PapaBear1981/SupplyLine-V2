import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

export class ToolsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get root(): Locator {
    return this.page.getByTestId('tools-page');
  }

  get searchInput(): Locator {
    return this.page.getByTestId('tools-search-input');
  }

  get createButton(): Locator {
    return this.page.getByTestId('tools-create-button');
  }

  get checkoutButton(): Locator {
    return this.page.getByTestId('tools-checkout-button');
  }

  get table(): Locator {
    return this.page.getByTestId('tools-table');
  }

  /** antd Table renders rows as `<tr data-row-key="<id>">`. */
  row(toolId: string | number): Locator {
    return this.table.locator(`tr[data-row-key="${toolId}"]`);
  }

  async open(): Promise<void> {
    await this.goto('/tools');
    await this.root.waitFor({ state: 'visible' });
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
  }
}
