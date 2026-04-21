import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { TEST_USERS } from '../../fixtures/test-data';

/**
 * Auth flows that should behave identically on every viewport.
 *
 * These tests deliberately opt out of the shared storageState (since they
 * want to start unauthenticated) by creating a fresh context per test.
 * Runs on desktop-chromium, mobile-iphone, and tablet-ipad projects.
 */
const test = base.extend<{ anonPage: import('@playwright/test').Page }>({
  // `provide` instead of Playwright's conventional `use` to avoid a false
  // positive from eslint-plugin-react-hooks detecting React 19's `use` hook.
  anonPage: async ({ browser }, provide) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await provide(page);
    await ctx.close();
  },
});

test.describe('Authentication (shared)', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ anonPage }) => {
    await anonPage.goto('/dashboard');
    await expect(anonPage).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('login form renders', async ({ anonPage }) => {
    const login = new LoginPage(anonPage);
    await login.goto();
    await expect(login.usernameInput).toBeVisible();
    await expect(login.passwordInput).toBeVisible();
    await expect(login.submitButton).toBeVisible();
  });

  test('invalid credentials keep the user on /login', async ({ anonPage }) => {
    const login = new LoginPage(anonPage);
    await login.goto();
    await login.submitCredentials(TEST_USERS.invalid.username, TEST_USERS.invalid.password);
    await anonPage.waitForTimeout(500); // allow error toast to render
    await expect(anonPage).toHaveURL(/\/login/);
    await expect(login.submitButton).toBeVisible();
  });

  test('valid credentials land on /dashboard', async ({ anonPage }) => {
    const login = new LoginPage(anonPage);
    await login.goto();
    await login.loginAs('admin');
    await expect(anonPage).toHaveURL(/\/dashboard/);
    await expect(anonPage.getByTestId('app-shell')).toBeVisible();
  });
});
