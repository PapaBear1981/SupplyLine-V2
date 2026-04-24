import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
} from '@playwright/test';
import { TEST_USERS, TEST_TOOLS } from '../../fixtures/test-data';

/**
 * Multi-warehouse scope E2E coverage for the tool-checkout + tool-history
 * endpoints. Drives the real backend via Playwright's request context so the
 * assertions are end-to-end (JWT minted with `active_warehouse_id` claim,
 * SQL filter applied) without the flakiness of clicking through the
 * Quick-Checkout wizard and inspecting rendered lists.
 *
 * Two principals are exercised:
 *   - USER001 (non-admin, pinned to Main by the seed) must only see tools
 *     and history for Main Warehouse.
 *   - ADMIN001 bypasses the filter and sees everything.
 *
 * Depends on data seeded by `backend/seed_e2e_test_data.py`:
 *   - Main Warehouse holds T001-T005.
 *   - Satellite Warehouse A holds T101 (the only tool outside Main).
 *   - Every seeded user starts with `active_warehouse_id` = Main.
 */

type Creds = { username: string; password: string };

async function login(ctx: APIRequestContext, { username, password }: Creds) {
  const resp = await ctx.post('/api/auth/login', {
    data: { employee_number: username, password },
  });
  expect(resp.ok(), `login failed for ${username}: ${resp.status()}`).toBeTruthy();
  const body = await resp.json();
  const token: string | undefined = body?.access_token;
  expect(token, `no access_token in login response for ${username}`).toBeTruthy();
  return token as string;
}

async function searchCheckoutTools(ctx: APIRequestContext, token: string, q: string) {
  const resp = await ctx.get(`/api/tool-checkout/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.ok(), `search failed: ${resp.status()}`).toBeTruthy();
  const body = await resp.json();
  return (body.tools ?? []) as Array<{ tool_number: string; id: number }>;
}

async function findToolByNumber(
  ctx: APIRequestContext,
  token: string,
  toolNumber: string,
): Promise<{ id: number; tool_number: string; warehouse_id: number | null } | null> {
  const resp = await ctx.get('/api/tools?per_page=200', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  const list = (body.tools ?? body.items ?? []) as Array<{
    id: number;
    tool_number: string;
    warehouse_id: number | null;
  }>;
  return list.find((t) => t.tool_number === toolNumber) ?? null;
}

test.describe('Tool checkout + history — warehouse scope (API, desktop)', () => {
  let ctx: APIRequestContext;

  test.beforeAll(async () => {
    const baseURL = test.info().project.use.baseURL as string | undefined;
    ctx = await playwrightRequest.newContext({ baseURL });
  });

  test.afterAll(async () => {
    await ctx?.dispose();
  });

  test('non-admin search only returns tools in the active warehouse', async () => {
    // USER001 is pinned to Main by the seed. The backend search endpoint
    // ignores queries shorter than 2 chars, so use "SN" — a substring
    // shared by every seeded tool's serial number (SN001-SN005, SN101) —
    // to force a search that *would* include T101 if the filter failed.
    const token = await login(ctx, TEST_USERS.user);
    const hits = await searchCheckoutTools(ctx, token, 'SN');
    const numbers = new Set(hits.map((t) => t.tool_number));

    expect(numbers.has(TEST_TOOLS.multimeter.number)).toBeTruthy();
    expect(numbers.has(TEST_TOOLS.torqueWrench.number)).toBeTruthy();
    expect(
      numbers.has(TEST_TOOLS.satelliteCaliper.number),
      'satellite tool leaked into Main-warehouse search results',
    ).toBeFalsy();
  });

  test('admin search returns tools from every warehouse', async () => {
    const token = await login(ctx, TEST_USERS.admin);
    const hits = await searchCheckoutTools(ctx, token, 'SN');
    const numbers = new Set(hits.map((t) => t.tool_number));

    expect(numbers.has(TEST_TOOLS.multimeter.number)).toBeTruthy();
    expect(
      numbers.has(TEST_TOOLS.satelliteCaliper.number),
      'admin should bypass warehouse scope and see satellite tools too',
    ).toBeTruthy();
  });

  test('non-admin 404s on history + timeline for a tool in a foreign warehouse', async () => {
    // Use the admin to resolve the satellite tool's id (USER001 can't see it).
    const adminToken = await login(ctx, TEST_USERS.admin);
    const satelliteTool = await findToolByNumber(
      ctx,
      adminToken,
      TEST_TOOLS.satelliteCaliper.number,
    );
    expect(
      satelliteTool,
      'satellite tool missing from admin /api/tools — check seed data',
    ).toBeTruthy();

    const userToken = await login(ctx, TEST_USERS.user);
    const historyResp = await ctx.get(
      `/api/tools/${satelliteTool!.id}/checkout-history`,
      { headers: { Authorization: `Bearer ${userToken}` } },
    );
    expect(historyResp.status()).toBe(404);

    const timelineResp = await ctx.get(`/api/tools/${satelliteTool!.id}/timeline`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(timelineResp.status()).toBe(404);
  });

  test('non-admin can read history for tools in their active warehouse', async () => {
    // Positive control: the same endpoints must still work for in-scope tools.
    const token = await login(ctx, TEST_USERS.user);
    const tool = await findToolByNumber(ctx, token, TEST_TOOLS.multimeter.number);
    expect(tool, 'main-warehouse tool missing from USER001 /api/tools').toBeTruthy();

    const historyResp = await ctx.get(
      `/api/tools/${tool!.id}/checkout-history`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(historyResp.ok()).toBeTruthy();

    const timelineResp = await ctx.get(`/api/tools/${tool!.id}/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(timelineResp.ok()).toBeTruthy();
  });
});
