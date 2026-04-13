import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { MobileScannerSheet } from '../components/MobileScannerSheet';
import {
  ScannerContext,
  type OpenScannerOptions,
  type ScannerContextValue,
} from './scannerContext';

interface ScannerProviderProps {
  children: ReactNode;
}

/**
 * Exposes an `openScanner()` function to any descendant. The provider
 * owns the scanner sheet, a single dismiss handler, and the optional
 * caller callback so calls from list pages, forms, or the global FAB
 * all share the same camera UX.
 *
 * Non-component exports (ScannerContext, useScanner, types) live in
 * `./scannerContext.ts` so this file can stay fast-refresh friendly.
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
