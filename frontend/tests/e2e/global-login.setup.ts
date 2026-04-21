import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_USERS } from '../fixtures/test-data';

/**
 * Authentication "setup" project — runs once before every other project and
 * writes `tests/.auth/user.json` so subsequent specs start already logged in.
 *
 * Relies on the backend running with `DISABLE_MANDATORY_2FA=true`, which
 * allows the seeded ADMIN001 user to log in with password only.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_STATE = path.resolve(__dirname, '../.auth/user.json');

setup('authenticate as admin', async ({ page }) => {
  const { username, password } = TEST_USERS.admin;

  await page.goto('/login');

  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  // Expect a real redirect to the dashboard — no silent `.catch()` fallback.
  // If this times out, the backend's 2FA gate is active and the suite must
  // not proceed, because every downstream spec depends on this session.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.getByTestId('app-shell')).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
