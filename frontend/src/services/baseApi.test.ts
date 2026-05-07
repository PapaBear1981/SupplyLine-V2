import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The token-expiry bootstrap is module-level state, so each test reloads
 * the module via vi.resetModules() after priming localStorage.
 */
async function loadBaseApi() {
  vi.resetModules();
  return await import('./baseApi');
}

describe('baseApi token expiry bootstrap', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(localStorage.getItem).mockReset();
    vi.mocked(localStorage.setItem).mockReset();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when localStorage has no stored expiry (fresh load)', async () => {
    const { getTokenExpiresAt } = await loadBaseApi();
    expect(getTokenExpiresAt()).toBeNull();
  });

  it('hydrates tokenExpiresAt from localStorage on module load', async () => {
    // Regression test for the 30-minute logout bug. Before the fix, a page
    // reload reset tokenExpiresAt to null, which short-circuited the
    // proactive refresh in baseQueryWithAuth and let the JWT die at the
    // 30-minute mark.
    const expiry = NOW + 25 * 60 * 1000; // 25 minutes from now
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token_expires_at') return String(expiry);
      return null;
    });

    const { getTokenExpiresAt } = await loadBaseApi();
    expect(getTokenExpiresAt()).toBe(expiry);
  });

  it('returns null when the stored expiry is not a parseable number', async () => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token_expires_at') return 'not-a-number';
      return null;
    });

    const { getTokenExpiresAt } = await loadBaseApi();
    expect(getTokenExpiresAt()).toBeNull();
  });

  it('returns null when the stored expiry is an empty string', async () => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token_expires_at') return '';
      return null;
    });

    const { getTokenExpiresAt } = await loadBaseApi();
    expect(getTokenExpiresAt()).toBeNull();
  });

  it('setTokenExpiration updates the in-memory value and writes through to localStorage', async () => {
    const { getTokenExpiresAt, setTokenExpiration } = await loadBaseApi();
    expect(getTokenExpiresAt()).toBeNull();

    setTokenExpiration(1800); // 30 minutes

    const expected = NOW + 1800 * 1000;
    expect(getTokenExpiresAt()).toBe(expected);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'token_expires_at',
      String(expected)
    );
  });

  it('setTokenExpiration overwrites a hydrated value', async () => {
    const stored = NOW + 5 * 60 * 1000;
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token_expires_at') return String(stored);
      return null;
    });

    const { getTokenExpiresAt, setTokenExpiration } = await loadBaseApi();
    expect(getTokenExpiresAt()).toBe(stored);

    setTokenExpiration(60); // 1 minute
    expect(getTokenExpiresAt()).toBe(NOW + 60_000);
  });
});
