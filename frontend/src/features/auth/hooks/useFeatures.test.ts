import { describe, it, expect, afterEach, vi } from 'vitest';

import { getFeatures } from './useFeatures';

const setEnv = (overrides: Record<string, string | undefined>) => {
  // Vite injects env into import.meta.env at build time but it's writable in tests.
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      delete import.meta.env[key];
    } else {
      import.meta.env[key] = value;
    }
  });
};

const ORIGINAL = { ...import.meta.env };

afterEach(() => {
  // Restore every key we may have touched.
  setEnv({
    VITE_FEATURE_KIT_MANAGEMENT: ORIGINAL.VITE_FEATURE_KIT_MANAGEMENT as
      | string
      | undefined,
    VITE_FEATURE_REQUESTS: ORIGINAL.VITE_FEATURE_REQUESTS as string | undefined,
    VITE_FEATURE_CHEMICAL_REORDER: ORIGINAL.VITE_FEATURE_CHEMICAL_REORDER as
      | string
      | undefined,
  });
  vi.restoreAllMocks();
});

describe('getFeatures', () => {
  it('defaults all flags to false when env vars are missing', () => {
    setEnv({
      VITE_FEATURE_KIT_MANAGEMENT: undefined,
      VITE_FEATURE_REQUESTS: undefined,
      VITE_FEATURE_CHEMICAL_REORDER: undefined,
    });
    expect(getFeatures()).toEqual({
      kitManagement: false,
      requests: false,
      chemicalReorder: false,
    });
  });

  it('treats "false" as off', () => {
    setEnv({
      VITE_FEATURE_KIT_MANAGEMENT: 'false',
      VITE_FEATURE_REQUESTS: 'false',
      VITE_FEATURE_CHEMICAL_REORDER: 'false',
    });
    expect(getFeatures()).toEqual({
      kitManagement: false,
      requests: false,
      chemicalReorder: false,
    });
  });

  it.each(['true', '1', 'yes', 'on', 'TRUE', 'On'])(
    'parses "%s" as on',
    (value) => {
      setEnv({
        VITE_FEATURE_KIT_MANAGEMENT: value,
        VITE_FEATURE_REQUESTS: undefined,
        VITE_FEATURE_CHEMICAL_REORDER: undefined,
      });
      expect(getFeatures().kitManagement).toBe(true);
    },
  );

  it('parses VITE_FEATURE_CHEMICAL_REORDER independently', () => {
    setEnv({
      VITE_FEATURE_KIT_MANAGEMENT: undefined,
      VITE_FEATURE_REQUESTS: undefined,
      VITE_FEATURE_CHEMICAL_REORDER: 'true',
    });
    expect(getFeatures().chemicalReorder).toBe(true);
  });
});
