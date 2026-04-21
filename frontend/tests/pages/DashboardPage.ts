import type { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get shell(): Locator {
    return this.appShell;
  }

  async open(): Promise<void> {
    await this.goto('/dashboard');
  }
}
