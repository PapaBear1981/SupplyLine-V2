import type { ReactNode } from 'react';
import { useIsMobile } from '@shared/hooks/useMobile';

interface ResponsivePageProps {
  /** Component rendered on desktop (viewport >= 768px). */
  desktop: ReactNode;
  /** Component rendered on mobile (viewport < 768px). */
  mobile: ReactNode;
}

/**
 * Route-level responsive switch.
 *
 * Each `<Route>` that needs distinct desktop/mobile implementations can
 * use this helper instead of scattering `if (isMobile)` branches inside
 * every page component. The desktop and mobile trees never render at the
 * same time, so module-level side effects (RTK Query hook calls,
 * leaflet imports, etc.) remain isolated to the variant that is actually
 * active for the current viewport.
 */
export const ResponsivePage = ({ desktop, mobile }: ResponsivePageProps) => {
  const isMobile = useIsMobile();
  return <>{isMobile ? mobile : desktop}</>;
};
