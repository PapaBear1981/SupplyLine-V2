import type { ReactNode } from 'react';
import { Button } from 'antd-mobile';
import { InboxOutlined } from '@ant-design/icons';
import './MobilePrimitives.css';

interface MobileEmptyStateProps {
  /** Headline (e.g. "No orders yet"). */
  title: string;
  /** Explanatory text below the title. */
  description?: string;
  /** Icon rendered above the title. Defaults to an inbox icon. */
  icon?: ReactNode;
  /** Optional call-to-action button. */
  actionLabel?: string;
  /** Called when the action button is pressed. */
  onAction?: () => void;
}

/**
 * Uniform empty-state component for mobile lists and detail sections.
 *
 * Avoids the inconsistent "Empty" / "No results" / "Nothing here yet"
 * patterns sprinkled across existing mobile views.
 */
export const MobileEmptyState = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: MobileEmptyStateProps) => {
  return (
    <div className="mobile-empty-state">
      <div className="mobile-empty-state__icon">{icon ?? <InboxOutlined />}</div>
      <div className="mobile-empty-state__title">{title}</div>
      {description && (
        <div className="mobile-empty-state__description">{description}</div>
      )}
      {actionLabel && onAction && (
        <Button color="primary" onClick={onAction} className="mobile-empty-state__action">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
