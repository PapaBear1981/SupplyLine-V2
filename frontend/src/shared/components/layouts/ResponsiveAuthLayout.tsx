import { AuthLayout } from './AuthLayout';
import { MobileAuthLayout } from '../mobile/MobileAuthLayout';
import { useIsMobile } from '@shared/hooks/useMobile';

/**
 * Responsive auth layout that switches between desktop and mobile layouts
 * based on viewport width
 */
export const ResponsiveAuthLayout = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileAuthLayout />;
  }

  return <AuthLayout />;
};
