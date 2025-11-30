import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useMobile } from '../hooks/useMobile';
import type { MobileState } from '../hooks/useMobile';

const MobileContext = createContext<MobileState | undefined>(undefined);

interface MobileProviderProps {
  children: ReactNode;
}

/**
 * Provider component that wraps the app and provides mobile detection state
 */
export function MobileProvider({ children }: MobileProviderProps) {
  const mobileState = useMobile();

  return (
    <MobileContext.Provider value={mobileState}>
      {children}
    </MobileContext.Provider>
  );
}

/**
 * Hook to access the mobile context
 * Must be used within a MobileProvider
 */
export function useMobileContext(): MobileState {
  const context = useContext(MobileContext);
  if (context === undefined) {
    throw new Error('useMobileContext must be used within a MobileProvider');
  }
  return context;
}

/**
 * Higher-order component that provides mobile props to wrapped components
 */
export function withMobile<P extends object>(
  Component: React.ComponentType<P & MobileState>
): React.FC<P> {
  return function WithMobileComponent(props: P) {
    const mobileState = useMobileContext();
    return <Component {...props} {...mobileState} />;
  };
}

export { MobileContext };
