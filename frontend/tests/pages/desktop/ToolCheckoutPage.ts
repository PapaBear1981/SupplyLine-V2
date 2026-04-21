import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

export class ToolCheckoutPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get root(): Locator {
    return this.page.getByTestId('checkout-page');
  }

  get createButton(): Locator {
    return this.page.getByTestId('checkout-create-button');
  }

  async open(): Promise<void> {
    await this.goto('/tool-checkout');
    await this.root.waitFor({ state: 'visible' });
  }
}
