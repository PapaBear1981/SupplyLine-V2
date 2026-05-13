import { describe, it, expect, afterEach, vi } from 'vitest';

import { getFeatures } from './useFeatures';

const setEnv = (overrides: Record<string, string | undefined>) => {
  // Vite injects env into import.meta.env at build time but it's writable in tests.
  Object.assign(import.meta.env, overrides);
};

const ORIGINAL = { ...import.meta.env };

afterEach(() => {
  // Restore every key we may have touched.
  setEnv({
    VITE_FEATURE_KIT_MANAGEMENT: ORIGINAL.VITE_FEATURE_KIT_MANAGEMENT as
      | string
      | undefined,
    VITE_FEATURE_REQUESTS: ORIGINAL.VITE_FEATURE_REQUESTS as string | undefined,
  });
  vi.restoreAllMocks();
});

describe('getFeatures', () => {
  it('defaults all flags to false when env vars are missing', () => {
    setEnv({
      VITE_FEATURE_KIT_MANAGEMENT: undefined,
      VITE_FEATURE_REQUESTS: undefined,
    });
    expect(getFeatures()).toEqual({ kitManagement: false, requests: false });
  });

  it('treats "false" as off', () => {
    setEnv({
      VITE_FEATURE_KIT_MANAGEMENT: 'false',
      VITE_FEATURE_REQUESTS: 'false',
    });
    expect(getFeatures()).toEqual({ kitManagement: false, requests: false });
  });

  it.each(['true', '1', 'yes', 'on', 'TRUE', 'On'])(
    'parses "%s" as on',
    (value) => {
      setEnv({
        VITE_FEATURE_KIT_MANAGEMENT: value,
        VITE_FEATURE_REQUESTS: undefined,
      });
      expect(getFeatures().kitManagement).toBe(true);
    },
  );
});
