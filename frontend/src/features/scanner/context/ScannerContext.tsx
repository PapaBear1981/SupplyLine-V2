import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { MobileScannerSheet } from '../components/MobileScannerSheet';

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

interface OpenScannerOptions {
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

interface ScannerContextValue {
  openScanner: (options?: OpenScannerOptions) => void;
  closeScanner: () => void;
  isOpen: boolean;
}

const ScannerContext = createContext<ScannerContextValue | undefined>(undefined);

interface ScannerProviderProps {
  children: ReactNode;
}

/**
 * Exposes an `openScanner()` function to any descendant. The provider
 * owns the scanner sheet, a single dismiss handler, and the optional
 * caller callback so calls from list pages, forms, or the global FAB
 * all share the same camera UX.
 */
export const ScannerProvider = ({ children }: ScannerProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<OpenScannerOptions | undefined>();

  const openScanner = useCallback((nextOptions?: OpenScannerOptions) => {
    setOptions(nextOptions);
    setIsOpen(true);
  }, []);

  const closeScanner = useCallback(() => {
    setIsOpen(false);
    // Clear options on the next tick so the sheet transition finishes
    // before React re-renders the (now-empty) callback prop.
    window.setTimeout(() => setOptions(undefined), 200);
  }, []);

  const value = useMemo<ScannerContextValue>(
    () => ({ openScanner, closeScanner, isOpen }),
    [openScanner, closeScanner, isOpen]
  );

  return (
    <ScannerContext.Provider value={value}>
      {children}
      <MobileScannerSheet
        visible={isOpen}
        onClose={closeScanner}
        onResolved={options?.onResolved}
        title={options?.title}
        accept={options?.accept}
      />
    </ScannerContext.Provider>
  );
};

export function useScanner(): ScannerContextValue {
  const ctx = useContext(ScannerContext);
  if (!ctx) {
    throw new Error('useScanner must be used within a ScannerProvider');
  }
  return ctx;
}
