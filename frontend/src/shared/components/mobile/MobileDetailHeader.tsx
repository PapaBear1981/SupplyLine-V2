import type { ReactNode } from 'react';
import './MobilePrimitives.css';

interface MobileDetailHeaderProps {
  /** Main title (e.g. "ORD-00123"). */
  title: string;
  /** Optional subtitle (e.g. record title or description). */
  subtitle?: ReactNode;
  /** Inline tags/badges rendered below the subtitle (status, priority, etc.). */
  tags?: ReactNode;
  /** Action buttons rendered on the right side. */
  actions?: ReactNode;
  /** Optional icon or avatar rendered at the start of the header. */
  leading?: ReactNode;
}

/**
 * Standardized header for mobile detail pages.
 *
 * Keeps the title + badges + action layout consistent across orders,
 * requests, kits, tools, checkouts, and chemicals.
 */
export const MobileDetailHeader = ({
  title,
  subtitle,
  tags,
  actions,
  leading,
}: MobileDetailHeaderProps) => {
  return (
    <div className="mobile-detail-header">
      <div className="mobile-detail-header__row">
        {leading && <div className="mobile-detail-header__leading">{leading}</div>}
        <div className="mobile-detail-header__text">
          <div className="mobile-detail-header__title">{title}</div>
          {subtitle && <div className="mobile-detail-header__subtitle">{subtitle}</div>}
        </div>
        {actions && <div className="mobile-detail-header__actions">{actions}</div>}
      </div>
      {tags && <div className="mobile-detail-header__tags">{tags}</div>}
    </div>
  );
};
