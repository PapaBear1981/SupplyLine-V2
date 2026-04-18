import { MobilePageScaffold } from './MobilePageScaffold';
import { MobileEmptyState } from './MobileEmptyState';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@shared/constants/routes';

interface MobileComingSoonProps {
  /** Feature name shown in the heading. */
  feature: string;
  /** Short description telling the user why this screen exists. */
  description?: string;
}

/**
 * Temporary placeholder shown on mobile routes whose real mobile
 * implementation is still in progress.
 *
 * This is strictly better than silently rendering the desktop page:
 * the mobile user sees a clear message, stays inside the mobile shell,
 * and can navigate away without encountering broken layouts.
 */
export const MobileComingSoon = ({ feature, description }: MobileComingSoonProps) => {
  const navigate = useNavigate();

  return (
    <MobilePageScaffold>
      <MobileEmptyState
        icon={<ClockCircleOutlined />}
        title={`${feature} — Coming to Mobile`}
        description={
          description ??
          `The mobile version of ${feature.toLowerCase()} is in progress. For now, please use the desktop app for this feature.`
        }
        actionLabel="Back to Dashboard"
        onAction={() => navigate(ROUTES.DASHBOARD)}
      />
    </MobilePageScaffold>
  );
};
