import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isCI = !!process.env.CI;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright config for the SupplyLine-V2 web app.
 *
 * Projects split by filename suffix:
 *   *.desktop.spec.ts  → desktop-chromium
 *   *.mobile.spec.ts   → mobile-iphone, mobile-pixel
 *   *.tablet.spec.ts   → tablet-ipad
 *   *.shared.spec.ts   → runs on every device project
 *
 * Auth: backend runs with `DISABLE_MANDATORY_2FA=true` so seeded users can
 * log in with password only. `global-setup.ts` performs one login and saves
 * storageState so each worker starts already authenticated. A dedicated
 * `auth-totp` spec exercises the real 2FA path against the TOTP001 user.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  globalSetup: path.resolve(__dirname, './tests/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './tests/global-teardown.ts'),
  outputDir: 'test-results',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Auth setup project — seeds storageState used by every other project.
    {
      name: 'setup',
      testMatch: /global-login\.setup\.ts$/,
    },
    {
      name: 'desktop-chromium',
      testMatch: /.*(\.desktop|\.shared)\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: '.auth/user.json',
      },
    },
    {
      name: 'mobile-iphone',
      testMatch: /.*(\.mobile|\.shared)\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['iPhone 13'],
        storageState: '.auth/user.json',
      },
    },
    {
      name: 'mobile-pixel',
      testMatch: /.*\.mobile\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['Pixel 7'],
        storageState: '.auth/user.json',
      },
    },
    {
      name: 'tablet-ipad',
      testMatch: /.*(\.tablet|\.shared)\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['iPad Pro 11'],
        storageState: '.auth/user.json',
      },
    },
  ],

  // Only start the Vite dev server here. The Flask backend is expected to be
  // running on :5000 with DISABLE_MANDATORY_2FA=true — CI starts it in a
  // separate workflow step; locally run `npm run test:e2e:seed` then
  // `cd ../backend && DISABLE_MANDATORY_2FA=true python run.py`.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
