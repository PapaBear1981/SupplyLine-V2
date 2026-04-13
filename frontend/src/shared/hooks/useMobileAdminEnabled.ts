import { useGetMobileSettingsQuery } from '@features/admin/services/securityApi';

/**
 * Hook that returns whether mobile admin access is enabled system-wide.
 *
 * Reads /api/mobile/settings via RTK Query. If the request is still
 * in flight or fails, returns false — admins can flip this from the
 * desktop System Settings page (Admin → System Settings → Mobile
 * Access). The Phase 1 placeholder that hard-coded `false` is now
 * replaced by a real backend-backed lookup.
 *
 * Note: both admin and non-admin users fetch this on mobile so the
 * layout can decide whether to expose the admin menu entry. The
 * backend endpoint is authentication-gated but not permission-gated
 * for reads.
 */
export function useMobileAdminEnabled(): boolean {
  const { data } = useGetMobileSettingsQuery();
  return Boolean(data?.mobile_admin_enabled);
}
