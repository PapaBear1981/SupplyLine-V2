import { useGetMobileSettingsQuery } from '@features/admin/services/securityApi';

export interface MobileAdminEnabledResult {
  /** True when the system-wide toggle is on. */
  isEnabled: boolean;
  /** True while the setting is being fetched for the first time. */
  isLoading: boolean;
  /** True if the fetch failed. Callers may want to treat this as "unknown". */
  isError: boolean;
}

/**
 * Hook that returns the mobile admin toggle state from the system
 * setting exposed at `GET /api/mobile/settings`.
 *
 * Returns a three-part result so callers can distinguish loading /
 * error / explicitly-disabled. The mobile admin page needs this to
 * avoid flashing a "Mobile Admin Disabled" message while the setting
 * is still being fetched for the first time.
 *
 * The menu layer (MobileLayout) only cares about the boolean, so it
 * pulls `isEnabled` and ignores the rest.
 */
export function useMobileAdminEnabled(): MobileAdminEnabledResult {
  const { data, isLoading, isError } = useGetMobileSettingsQuery();
  return {
    isEnabled: Boolean(data?.mobile_admin_enabled),
    isLoading,
    isError,
  };
}
