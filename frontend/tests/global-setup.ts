import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Playwright global setup.
 *
 * Intentionally minimal — actual login is performed by the `setup` project
 * (see `tests/e2e/global-login.setup.ts`) so that Playwright's browser
 * lifecycle, tracing, and worker management all apply to it. This hook only
 * ensures the `.auth/` directory exists and emits a clear log line so CI
 * output shows the auth bootstrap is running.
 *
 * Database seeding is performed by the CI workflow (or by
 * `npm run test:e2e:seed` locally) before Playwright starts; doing it here
 * would re-seed on every `playwright test` invocation and stomp on any
 * in-progress spec.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(): Promise<void> {
  const authDir = path.resolve(__dirname, '.auth');
  fs.mkdirSync(authDir, { recursive: true });
  console.log('[e2e] global-setup: auth dir ready at', authDir);
}
