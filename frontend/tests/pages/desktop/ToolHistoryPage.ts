import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

export class ToolHistoryPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get root(): Locator {
    return this.page.getByTestId('tool-audit-history-page');
  }

  get table(): Locator {
    return this.page.getByTestId('tool-audit-history-table');
  }

  get eventTypeSelect(): Locator {
    return this.root.locator('.ant-select').first();
  }

  get toolSearchInput(): Locator {
    return this.root.locator('input[placeholder*="tool number"]');
  }

  async open(): Promise<void> {
    await this.goto('/tool-history');
    await this.root.waitFor({ state: 'visible' });
  }
}
