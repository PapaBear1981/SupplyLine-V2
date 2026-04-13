import type { ReactNode } from 'react';
import './MobilePrimitives.css';

interface MobileSectionCardProps {
  title?: ReactNode;
  /** Optional right-side element (e.g. action button, count, badge). */
  extra?: ReactNode;
  /** Footer rendered below the body (e.g. action row). */
  footer?: ReactNode;
  /** Card body. */
  children: ReactNode;
  /** Remove internal padding so children control layout. */
  flush?: boolean;
}

/**
 * Rounded card used for sections inside mobile detail pages.
 *
 * Keeps the visual rhythm consistent: all cards have the same radius,
 * shadow, and padding — detail pages can mix multiple stacked cards
 * without styling drift.
 */
export const MobileSectionCard = ({
  title,
  extra,
  footer,
  children,
  flush = false,
}: MobileSectionCardProps) => {
  // Use explicit null/undefined checks so legitimate `0` content
  // (e.g., a count badge showing "0 pending") still renders.
  const hasTitle = title !== undefined && title !== null;
  const hasExtra = extra !== undefined && extra !== null;

  return (
    <div className="mobile-section-card">
      {(hasTitle || hasExtra) && (
        <div className="mobile-section-card__header">
          {hasTitle && <div className="mobile-section-card__title">{title}</div>}
          {hasExtra && <div className="mobile-section-card__extra">{extra}</div>}
        </div>
      )}
      <div
        className={`mobile-section-card__body ${flush ? 'mobile-section-card__body--flush' : ''}`}
      >
        {children}
      </div>
      {footer !== undefined && footer !== null && (
        <div className="mobile-section-card__footer">{footer}</div>
      )}
    </div>
  );
};
