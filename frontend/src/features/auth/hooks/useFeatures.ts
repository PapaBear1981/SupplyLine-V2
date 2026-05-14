/**
 * Feature flag hook.
 *
 * Mirrors the backend `FEATURE_*` env vars exposed at build time via Vite.
 * Defaults to `true` so existing deployments keep their established
 * navigation/API surfaces unless an operator explicitly disables them.
 *
 * Keep flag names in sync with `backend/auth/feature_flags.py`.
 */
export interface FeatureFlags {
  /** Kit Management surface: wizard, master kits, transfers, reorders, etc. */
  kitManagement: boolean;
  /** User Requests / Fulfillment surface. */
  requests: boolean;
}

function parseFlag(value: string | undefined): boolean {
  if (!value) return true;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

export function getFeatures(): FeatureFlags {
  return {
    kitManagement: parseFlag(import.meta.env.VITE_FEATURE_KIT_MANAGEMENT),
    requests: parseFlag(import.meta.env.VITE_FEATURE_REQUESTS),
  };
}

export function useFeatures(): FeatureFlags {
  return getFeatures();
}
