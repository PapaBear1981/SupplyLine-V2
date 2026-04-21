import { test as base, expect } from '@playwright/test';
import { MobileLoginPage } from '../../pages/mobile/MobileLoginPage';
import { TEST_USERS } from '../../fixtures/test-data';

/**
 * Mobile-specific login coverage. Uses the `mobile-iphone` / `mobile-pixel`
 * projects (viewport < 768px) so `useIsMobile()` renders the
 * `MobileLoginForm` variant rather than the desktop `LoginForm`.
 *
 * Each test starts from a fresh unauthenticated context to bypass the
 * shared storageState.
 */
const test = base.extend<{ anonPage: import('@playwright/test').Page }>({
  anonPage: async ({ browser }, provide) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await provide(page);
    await ctx.close();
  },
});

test.describe('Mobile login', () => {
  test('mobile form renders on small viewports', async ({ anonPage }) => {
    const login = new MobileLoginPage(anonPage);
    await login.goto();
    const viewport = anonPage.viewportSize();
    expect(viewport?.width).toBeLessThan(768);
    await expect(login.form).toBeVisible();
    await expect(login.usernameInput).toBeVisible();
    await expect(login.passwordInput).toBeVisible();
    await expect(login.submitButton).toBeVisible();
  });

  test('admin credentials land on the mobile dashboard', async ({ anonPage }) => {
    const login = new MobileLoginPage(anonPage);
    await login.goto();
    await login.loginAs('admin');
    await expect(anonPage).toHaveURL(/\/dashboard/);
    await expect(anonPage.getByTestId('app-shell')).toBeVisible();
    // Mobile dashboard should be rendered (not the desktop one) because
    // the mobile viewport triggered `useIsMobile()`.
    await expect(anonPage.getByTestId('mobile-dashboard')).toBeVisible({ timeout: 10_000 });
  });

  test('invalid credentials keep the user on /login', async ({ anonPage }) => {
    const login = new MobileLoginPage(anonPage);
    await login.goto();
    await login.usernameInput.fill(TEST_USERS.invalid.username);
    await login.passwordInput.fill(TEST_USERS.invalid.password);
    await login.submitButton.click();
    await anonPage.waitForTimeout(500); // allow toast to render
    await expect(anonPage).toHaveURL(/\/login/);
    await expect(login.submitButton).toBeVisible();
  });
});
