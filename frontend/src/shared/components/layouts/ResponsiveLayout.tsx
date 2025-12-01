import { MainLayout } from './MainLayout';
import { MobileLayout } from '../mobile/MobileLayout';
import { useIsMobile } from '@shared/hooks/useMobile';

/**
 * Responsive layout that switches between desktop and mobile layouts
 * based on viewport width
 */
export const ResponsiveLayout = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileLayout />;
  }

  return <MainLayout />;
};
