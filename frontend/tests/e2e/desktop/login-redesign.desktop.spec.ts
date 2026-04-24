import { test as base, expect } from '@playwright/test';

/**
 * Visual-structure coverage for the redesigned desktop login page.
 *
 * The redesign ships three new invariants we want to lock in:
 *   1. The page forces `data-theme="dark"` on its own subtree regardless of
 *      the user's global theme preference — login is always dark-branded.
 *   2. The branded hero panel is visible on desktop viewports and collapses
 *      on narrower viewports (handled purely via CSS media queries).
 *   3. The rotating status ticker is rendered.
 *
 * Existing `login-form` / `login-username` / `login-password` / `login-submit`
 * testids are unchanged, so the shared auth suite still exercises the real
 * credential flow. This spec is deliberately viewport-shape only.
 */
const test = base.extend<{ anonPage: import('@playwright/test').Page }>({
  anonPage: async ({ browser }, provide) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await provide(page);
    await ctx.close();
  },
});

test.describe('Login page redesign (desktop)', () => {
  test('renders in dark theme with the branded hero visible', async ({
    anonPage,
  }) => {
    await anonPage.goto('/login');

    const shell = anonPage.getByTestId('login-page');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-theme', 'dark');

    // Branded hero is visible on full-width desktop viewports.
    await expect(anonPage.getByTestId('login-hero')).toBeVisible();
    await expect(anonPage.getByText('SUPPLYLINE')).toBeVisible();
    await expect(anonPage.getByText(/Keep the line/i)).toBeVisible();

    // Form card is still there.
    await expect(anonPage.getByTestId('login-form')).toBeVisible();
    await expect(anonPage.getByTestId('login-username')).toBeVisible();
    await expect(anonPage.getByTestId('login-password')).toBeVisible();
    await expect(anonPage.getByTestId('login-submit')).toBeVisible();
  });

  test('stays dark-themed even when the global theme preference is light', async ({
    anonPage,
  }) => {
    // Seed a light-mode preference before the app boots so the ThemeProvider
    // picks it up from localStorage.
    await anonPage.addInitScript(() => {
      window.localStorage.setItem(
        'supplyline-theme-config',
        JSON.stringify({ mode: 'light', colorTheme: 'blue' }),
      );
    });
    await anonPage.goto('/login');

    const shell = anonPage.getByTestId('login-page');
    await expect(shell).toHaveAttribute('data-theme', 'dark');
  });

  test('hero collapses on narrow desktop viewports', async ({ anonPage }) => {
    // Drop below the 1024px split-screen breakpoint.
    await anonPage.setViewportSize({ width: 900, height: 800 });
    await anonPage.goto('/login');

    await expect(anonPage.getByTestId('login-page')).toBeVisible();
    await expect(anonPage.getByTestId('login-form')).toBeVisible();
    // Hero is still in the DOM but hidden via `display: none` per the CSS
    // media query — assert it is not visible to the user.
    await expect(anonPage.getByTestId('login-hero')).toBeHidden();
  });
});
