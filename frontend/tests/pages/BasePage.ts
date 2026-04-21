import type { Page, Locator } from '@playwright/test';

/**
 * Shared navigation + wait helpers. Subclass per page; keep method names
 * action-oriented (`openMenu`, `submit`) rather than DOM-oriented.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  get appShell(): Locator {
    return this.page.getByTestId('app-shell');
  }

  async waitForShell(): Promise<void> {
    await this.appShell.waitFor({ state: 'visible' });
  }

  async goto(pathname: string): Promise<void> {
    await this.page.goto(pathname);
    await this.waitForShell();
  }
}
