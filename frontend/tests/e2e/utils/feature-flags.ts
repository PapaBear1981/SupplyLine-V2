/**
 * Feature-flag helpers for Playwright specs.
 *
 * The frontend reads these from `import.meta.env.VITE_FEATURE_*` at build
 * time, but Playwright tests run in Node and can read them off `process.env`
 * directly — both are populated by the workflow-level `env:` blocks.
 *
 * Defaults match the backend / Vite default ("off") so specs targeting
 * deactivated UIs are skipped when the matching flag is missing.
 */
const parse = (value: string | undefined): boolean =>
  !!value && ['true', '1', 'yes', 'on'].includes(value.toLowerCase());

export const FEATURES = {
  kitManagement: parse(process.env.VITE_FEATURE_KIT_MANAGEMENT),
  requests: parse(process.env.VITE_FEATURE_REQUESTS),
};

export const kitManagementOn = FEATURES.kitManagement;
export const requestsOn = FEATURES.requests;
