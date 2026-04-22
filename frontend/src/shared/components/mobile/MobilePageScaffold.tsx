import type { ReactNode } from 'react';
import './MobilePrimitives.css';

interface MobilePageScaffoldProps {
  /** Page header (typically a MobileDetailHeader or inline title). */
  header?: ReactNode;
  /** Optional sticky search/filter/tab bar rendered below the header. */
  sticky?: ReactNode;
  /** Main scrollable content. */
  children: ReactNode;
  /** Extra bottom padding to clear floating action buttons / tab bar. */
  bottomSafe?: boolean;
  /** Optional className for the root element. */
  className?: string;
  /** Optional data-testid for the root element. */
  testId?: string;
}

/**
 * Consistent wrapper for mobile pages. Adds safe-area padding, controls
 * scroll behavior, and hosts an optional sticky region (search bars, tabs).
 *
 * Use this instead of hand-rolling padding on every mobile page so content
 * never sits under the tab bar or floating-action-button.
 */
export const MobilePageScaffold = ({
  header,
  sticky,
  children,
  bottomSafe = true,
  className = '',
  testId,
}: MobilePageScaffoldProps) => {
  return (
    <div
      className={`mobile-page-scaffold ${bottomSafe ? 'mobile-page-scaffold--bottom-safe' : ''} ${className}`}
      data-testid={testId}
    >
      {header && <div className="mobile-page-scaffold__header">{header}</div>}
      {sticky && <div className="mobile-page-scaffold__sticky">{sticky}</div>}
      <div className="mobile-page-scaffold__body">{children}</div>
    </div>
  );
};
