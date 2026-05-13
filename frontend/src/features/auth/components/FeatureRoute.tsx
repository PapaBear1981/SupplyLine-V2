import { Navigate } from 'react-router-dom';
import { useFeatures } from '../hooks/useFeatures';
import type { FeatureFlags } from '../hooks/useFeatures';
import type { ReactElement } from 'react';

interface FeatureRouteProps {
  feature: keyof FeatureFlags;
  redirectTo?: string;
  children: ReactElement;
}

/**
 * Route guard that redirects when the named feature flag is off.
 *
 * Used to keep deactivated Kit Management / Requests UIs registered (so the
 * code path doesn't bit-rot) while preventing end users from landing on them.
 */
export function FeatureRoute({
  feature,
  redirectTo = '/',
  children,
}: FeatureRouteProps) {
  const features = useFeatures();
  if (!features[feature]) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}
