/**
 * Feature flag hook.
 *
 * Mirrors the backend `FEATURE_*` env vars exposed at build time via Vite.
 * Defaults to `false` so a missing var deactivates the feature rather than
 * leaving disabled UI exposed.
 *
 * Keep flag names in sync with `backend/auth/feature_flags.py`.
 */
export interface FeatureFlags {
  /** Kit Management surface: wizard, master kits, transfers, reorders, etc. */
  kitManagement: boolean;
  /** User Requests / Fulfillment surface. */
  requests: boolean;
  /** Chemical reorder system: reorder requests, forecast page, reorder alerts. */
  chemicalReorder: boolean;
}

function parseFlag(value: string | undefined): boolean {
  if (!value) return false;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

export function getFeatures(): FeatureFlags {
  return {
    kitManagement: parseFlag(import.meta.env.VITE_FEATURE_KIT_MANAGEMENT),
    requests: parseFlag(import.meta.env.VITE_FEATURE_REQUESTS),
    chemicalReorder: parseFlag(import.meta.env.VITE_FEATURE_CHEMICAL_REORDER),
  };
}

export function useFeatures(): FeatureFlags {
  return getFeatures();
}
