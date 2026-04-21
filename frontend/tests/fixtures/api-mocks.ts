import type { Page, Route } from '@playwright/test';
import { TEST_USERS } from './test-data';

/**
 * API-mock helpers extracted from the original `chemical-forecast.spec.ts`.
 * Any spec that wants to test UI behavior without touching a real backend
 * should stack handlers via `page.route()` before navigating. Handlers are
 * matched in registration order by URL substring.
 */

export type ApiMock = {
  urlIncludes: string;
  response: unknown;
  status?: number;
  /** If set, only match requests whose method equals this (GET/POST/...). */
  method?: string;
};

export const MOCK_ADMIN_USER = {
  id: 1,
  employee_number: TEST_USERS.admin.username,
  first_name: 'Admin',
  last_name: 'User',
  is_admin: true,
  role: 'admin',
  permissions: [],
};

/** Inject a fake JWT + optional localStorage keys so the app boots authed. */
export async function seedAuthedLocalStorage(page: Page, token = 'mock-jwt-token-for-playwright'): Promise<void> {
  await page.addInitScript((t) => {
    localStorage.setItem('access_token', t);
  }, token);
}

/**
 * Install a catch-all `/api/**` handler that dispatches by URL substring.
 * Any unmatched call gets a safe `[]` response to avoid RTK Query blowing up.
 *
 * Example:
 *   await installApiMocks(page, [
 *     { urlIncludes: '/api/chemicals/forecast', response: FORECAST_FIXTURE },
 *   ]);
 */
export async function installApiMocks(page: Page, mocks: ApiMock[]): Promise<void> {
  await page.route('**/api/**', (route: Route) => {
    const req = route.request();
    const url = req.url();

    // Always answer `/api/auth/me` so ProtectedRoute doesn't bounce to login.
    if (url.includes('/api/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: MOCK_ADMIN_USER }),
      });
    }

    // Disable the AI assistant by default — it opens a socket on mount.
    if (url.includes('/api/ai/settings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: false,
          provider: 'claude',
          model: '',
          base_url: '',
          api_key_configured: false,
        }),
      });
    }

    for (const mock of mocks) {
      if (mock.method && req.method() !== mock.method) continue;
      if (url.includes(mock.urlIncludes)) {
        return route.fulfill({
          status: mock.status ?? 200,
          contentType: 'application/json',
          body: JSON.stringify(mock.response),
        });
      }
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

/**
 * Convenience wrapper for specs that want a fully-mocked, authed page with
 * just a handful of custom endpoint responses.
 */
export async function mockAuthedPage(page: Page, mocks: ApiMock[] = []): Promise<void> {
  await seedAuthedLocalStorage(page);
  await installApiMocks(page, mocks);
}
