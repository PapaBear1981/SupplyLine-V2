import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { inputByTestId } from '../../fixtures/auth';
import { TEST_USERS } from '../../fixtures/test-data';

type CredKey = keyof typeof TEST_USERS;

/**
 * Mobile login page object. The underlying component (`MobileLoginForm`)
 * shares the same `login-*` testids as the desktop `LoginForm`, so specs
 * read the same even though the DOM differs.
 */
export class MobileLoginPage {
  constructor(private readonly page: Page) {}

  get form(): Locator {
    return this.page.getByTestId('login-form');
  }

  get usernameInput(): Locator {
    return inputByTestId(this.page, 'login-username');
  }

  get passwordInput(): Locator {
    return inputByTestId(this.page, 'login-password');
  }

  get submitButton(): Locator {
    return this.page.getByTestId('login-submit');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.form).toBeVisible();
  }

  async loginAs(userKey: Exclude<CredKey, 'invalid' | 'totp'> = 'admin'): Promise<void> {
    const creds = TEST_USERS[userKey];
    await this.usernameInput.fill(creds.username);
    await this.passwordInput.fill(creds.password);
    await this.submitButton.click();
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  }
}
