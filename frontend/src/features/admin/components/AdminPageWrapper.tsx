import { AdminPage } from '../pages/AdminPage';
import { MobileAdminPage } from './mobile/MobileAdminPage';
import { useIsMobile } from '@shared/hooks/useMobile';

/**
 * Wrapper for AdminPage that swaps between the desktop AdminPage
 * and the mobile admin hub based on viewport. The mobile side is
 * additionally gated by the mobile_admin_enabled system setting
 * (handled inside MobileAdminPage).
 */
export const AdminPageWrapper = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileAdminPage />;
  }

  return <AdminPage />;
};
