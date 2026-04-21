import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { TEST_USERS } from './test-data';

type TestUser = keyof typeof TEST_USERS;

/**
 * Locate a form input across desktop antd and antd-mobile components.
 *
 * - Desktop `antd.Input` forwards `data-testid` onto the native `<input>`.
 * - Mobile `antd-mobile.Input` wraps the native `<input>` in a div and
 *   puts `data-testid` on that wrapper.
 *
 * Matching either `input[data-testid=X]` or `[data-testid=X] input` and
 * taking the first match gives us a native input we can `.fill()` in both
 * worlds.
 */
export function inputByTestId(page: Page, testId: string): Locator {
  return page.locator(
    `input[data-testid="${testId}"], [data-testid="${testId}"] input`,
  ).first();
}

/**
 * Perform a password-only login against the live backend.
 *
 * Requires the backend to be running with `DISABLE_MANDATORY_2FA=true`, which
 * is wired up by `playwright.config.ts` and the CI workflow. If the backend
 * still enforces TOTP, `expect(page).toHaveURL(/dashboard/)` below will fail
 * loudly rather than silently — that's intentional, don't add a `.catch()`.
 */
export async function loginAs(page: Page, userKey: Exclude<TestUser, 'invalid' | 'totp'> = 'admin'): Promise<void> {
  const creds = TEST_USERS[userKey];
  await page.goto('/login');
  await inputByTestId(page, 'login-username').fill(creds.username);
  await inputByTestId(page, 'login-password').fill(creds.password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.getByTestId('app-shell')).toBeVisible();
}

/**
 * Clear any persisted session state (localStorage + cookies) on the
 * current page. Use this for specs that assert unauthenticated behavior,
 * e.g. protected-route redirects.
 */
export async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* storage may not yet be accessible on about:blank */
    }
  });
}

/**
 * Fixture variant that hands tests a fresh, unauthenticated page — useful
 * for login-flow specs that want to exercise the form itself.
 */
export const test = base.extend<{ unauthenticatedPage: Page }>({
  // Playwright's fixture callback is traditionally named `use`, but that
  // collides with React 19's `use` hook detection in
  // eslint-plugin-react-hooks. Renaming keeps lint clean — Playwright is
  // positional and doesn't care about the name.
  unauthenticatedPage: async ({ browser }, provide) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
export { TEST_USERS } from './test-data';
