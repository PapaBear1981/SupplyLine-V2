import { AdminPage } from '../pages/AdminPage';
import { DesktopOnlyMessage } from '@shared/components/mobile/DesktopOnlyMessage';
import { useIsMobile } from '@shared/hooks/useMobile';

/**
 * Wrapper for AdminPage that shows a desktop-only message on mobile devices
 */
export const AdminPageWrapper = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DesktopOnlyMessage
        title="Admin Panel - Desktop Only"
        description="The admin panel requires a larger screen for proper functionality. Please access it from a desktop or laptop computer."
      />
    );
  }

  return <AdminPage />;
};
