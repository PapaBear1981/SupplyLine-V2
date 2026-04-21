import { test as base, expect } from '@playwright/test';
import { generateSync } from 'otplib';
import { TEST_USERS } from '../../fixtures/test-data';

/**
 * Dedicated 2FA coverage. The rest of the suite bypasses TOTP via
 * `DISABLE_MANDATORY_2FA=true`, but the TOTP001 user is seeded with
 * `is_totp_enabled=true` and a known base32 secret so this spec can
 * exercise the real verification flow.
 *
 * The secret must match `E2E_TOTP_SECRET` in
 * `backend/seed_e2e_test_data.py`.
 */
const test = base.extend<{ anonPage: import('@playwright/test').Page }>({
  anonPage: async ({ browser }, provide) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await provide(page);
    await ctx.close();
  },
});

test.describe('Two-factor authentication', () => {
  test('TOTP user completes login with a generated code', async ({ anonPage }) => {
    const { username, password, totpSecret } = TEST_USERS.totp;

    // Step 1: password entry — triggers the backend's TOTP_REQUIRED branch
    // because DISABLE_MANDATORY_2FA only short-circuits users whose TOTP
    // isn't yet enabled; TOTP001 is enabled so the server still prompts.
    await anonPage.goto('/login');
    await anonPage.getByTestId('login-username').fill(username);
    await anonPage.getByTestId('login-password').fill(password);
    await anonPage.getByTestId('login-submit').click();

    // Step 2: TOTP challenge form appears.
    await expect(anonPage.getByTestId('totp-form')).toBeVisible({ timeout: 15_000 });

    // Step 3: generate a fresh code from the seeded secret and submit.
    const code = generateSync({ secret: totpSecret });
    await anonPage.getByTestId('totp-code-input').fill(code);
    await anonPage.getByTestId('totp-submit').click();

    // Step 4: successful verification lands on the dashboard.
    await expect(anonPage).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(anonPage.getByTestId('app-shell')).toBeVisible();
  });

  test('bad TOTP code keeps the user off /dashboard', async ({ anonPage }) => {
    const { username, password } = TEST_USERS.totp;

    await anonPage.goto('/login');
    await anonPage.getByTestId('login-username').fill(username);
    await anonPage.getByTestId('login-password').fill(password);
    await anonPage.getByTestId('login-submit').click();

    await expect(anonPage.getByTestId('totp-form')).toBeVisible({ timeout: 15_000 });
    await anonPage.getByTestId('totp-code-input').fill('000000');
    await anonPage.getByTestId('totp-submit').click();

    // The frontend flashes a toast and keeps the user on /login; the only
    // invariant that matters for this spec is that we do NOT transition
    // to /dashboard. The TOTP form itself may briefly re-render around
    // the antd/framer-motion animation, so don't assert on its visibility.
    await anonPage.waitForTimeout(1_500);
    await expect(anonPage).not.toHaveURL(/\/dashboard/);
  });
});
