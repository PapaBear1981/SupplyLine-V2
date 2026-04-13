/**
 * Hook that returns whether mobile admin access is enabled system-wide.
 *
 * Phase 1 ships this hook with a hard-coded `false` default so the mobile
 * layout and menu can already check it. Phase 5 will replace the
 * implementation with a real API call against the `mobile_admin_enabled`
 * system setting (/api/admin/mobile-settings), and add a matching
 * toggle to the desktop System Settings page.
 *
 * Consumers should always use this hook rather than hard-coding a
 * boolean — the hook will transparently start reading from the
 * system setting once Phase 5 wires it up.
 */
export function useMobileAdminEnabled(): boolean {
  // Phase 5 will replace this with:
  //   const { data } = useGetMobileAdminSettingQuery();
  //   return Boolean(data?.enabled);
  return false;
}
