import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isCI = !!process.env.CI;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the shared storageState written by the `setup` project.
 * Must match the path used in `tests/e2e/global-login.setup.ts`. Using a
 * relative path here causes Playwright to resolve it against the worker's
 * CWD (the test file's directory), producing ENOENT on every non-setup
 * test.
 */
const STORAGE_STATE = path.resolve(__dirname, 'tests/.auth/user.json');

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
  // Cap local workers at 4 to prevent parallel bcrypt calls from exhausting
  // the single SQLite backend and causing auth test timeouts.
  workers: isCI ? 2 : 4,
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
        storageState: STORAGE_STATE,
      },
    },
    {
      name: 'mobile-iphone',
      testMatch: /.*(\.mobile|\.shared)\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['iPhone 13'],
        // WebKit is unavailable on this host; Chromium preserves the mobile
        // viewport and touch emulation while still exercising the responsive UI.
        browserName: 'chromium',
        storageState: STORAGE_STATE,
      },
    },
    {
      name: 'mobile-pixel',
      testMatch: /.*\.mobile\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['Pixel 7'],
        storageState: STORAGE_STATE,
      },
    },
    {
      name: 'tablet-ipad',
      testMatch: /.*(\.tablet|\.shared)\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['iPad Pro 11'],
        // WebKit is unavailable on this host; Chromium preserves the tablet
        // viewport and touch emulation while still exercising the responsive UI.
        browserName: 'chromium',
        storageState: STORAGE_STATE,
      },
    },
  ],

  // Only start the Vite dev server here. The Flask backend is expected to be
  // running on :5000 with DISABLE_MANDATORY_2FA=true and DISABLE_RATE_LIMIT=true
  // — CI starts it in a separate workflow step; locally run `npm run test:e2e:seed`
  // then `cd ../backend && DISABLE_MANDATORY_2FA=true DISABLE_RATE_LIMIT=true python app.py`.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
