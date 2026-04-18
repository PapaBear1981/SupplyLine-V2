import type { ReactNode } from 'react';
import '../../styles/glassmorphism.css';
import './MobileAuthShell.css';

interface MobileAuthShellProps {
  children: ReactNode;
  /** Optional className for the inner card (e.g. to override padding). */
  cardClassName?: string;
}

/**
 * Mobile auth background + glass card wrapper.
 *
 * Shared by MobileLoginForm, MobileTotpVerification, and
 * MobileBackupCodeForm so all three auth states share the same
 * animated gradient backdrop and glass-card-elevated container
 * instead of each state reimplementing its own layout.
 */
export const MobileAuthShell = ({ children, cardClassName = '' }: MobileAuthShellProps) => {
  return (
    <div className="mobile-login-bg mobile-auth-shell">
      <div className={`mobile-auth-shell__card glass-card-elevated scale-in ${cardClassName}`}>
        {children}
      </div>
    </div>
  );
};
