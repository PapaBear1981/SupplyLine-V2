import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/test-data';

type CredKey = keyof typeof TEST_USERS;

export class LoginPage {
  constructor(private readonly page: Page) {}

  get form(): Locator {
    return this.page.getByTestId('login-form');
  }

  get usernameInput(): Locator {
    return this.page.getByTestId('login-username');
  }

  get passwordInput(): Locator {
    return this.page.getByTestId('login-password');
  }

  get submitButton(): Locator {
    return this.page.getByTestId('login-submit');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.form).toBeVisible();
  }

  /** Fill and submit credentials but do not assert any post-login state. */
  async submitCredentials(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Shorthand: log in as one of the seeded users and wait for /dashboard. */
  async loginAs(userKey: Exclude<CredKey, 'invalid' | 'totp'> = 'admin'): Promise<void> {
    const creds = TEST_USERS[userKey];
    await this.submitCredentials(creds.username, creds.password);
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  }
}
