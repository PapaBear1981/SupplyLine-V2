import { createContext, useContext } from 'react';

/**
 * Public shape of a scanner resolution — what the caller gets back
 * when it opens the scanner with a `onResolved` callback.
 */
export interface ScannerResolution {
  itemType: 'tool' | 'chemical' | 'kit';
  itemId: number;
  itemData?: Record<string, unknown>;
  warning?: string;
}

export interface OpenScannerOptions {
  /**
   * Optional callback invoked once the scanner resolves an item.
   *
   * If omitted, the ScannerProvider falls back to its default behavior
   * (navigate to the item's detail page). This is the path the floating
   * "Scan" FAB uses so mobile feature lists can jump directly to the
   * scanned record without coordinating with the scanner explicitly.
   */
  onResolved?: (result: ScannerResolution) => void;
  /**
   * Optional title shown at the top of the scanner sheet. Useful for
   * context-specific scans (e.g. "Scan tool to check out").
   */
  title?: string;
  /**
   * Optional accepted item types. When set, scans that resolve to other
   * types are rejected with a toast rather than invoked on the caller.
   */
  accept?: Array<ScannerResolution['itemType']>;
}

export interface ScannerContextValue {
  openScanner: (options?: OpenScannerOptions) => void;
  closeScanner: () => void;
  isOpen: boolean;
}

export const ScannerContext = createContext<ScannerContextValue | undefined>(undefined);

/**
 * Hook used by scanner callers to open the scanner sheet and subscribe
 * to resolutions. Separated from the provider file so this module can
 * live under React's fast-refresh "constants and hooks only" rules.
 */
export function useScanner(): ScannerContextValue {
  const ctx = useContext(ScannerContext);
  if (!ctx) {
    throw new Error('useScanner must be used within a ScannerProvider');
  }
  return ctx;
}
