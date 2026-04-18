import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MobileScannerSheet } from '../components/MobileScannerSheet';
import {
  ScannerContext,
  type OpenScannerOptions,
  type ScannerContextValue,
} from './scannerHooks';

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
 * `./scannerHooks.ts` so this file can stay fast-refresh friendly.
 */
export const ScannerProvider = ({ children }: ScannerProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<OpenScannerOptions | undefined>();

  // closeScanner schedules a tiny delayed clear of `options` so the sheet
  // transition finishes before React unmounts the (now-empty) callback
  // prop. That timer must be cancellable: if the user immediately
  // reopens the scanner, the pending timer would otherwise wipe the
  // fresh `options` and break onResolved/title/accept.
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openScanner = useCallback(
    (nextOptions?: OpenScannerOptions) => {
      clearCloseTimer();
      setOptions(nextOptions);
      setIsOpen(true);
    },
    [clearCloseTimer]
  );

  const closeScanner = useCallback(() => {
    setIsOpen(false);
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOptions(undefined);
      closeTimerRef.current = null;
    }, 200);
  }, [clearCloseTimer]);

  // Cancel any pending close timer on unmount so React doesn't try to
  // setState on a stale component.
  useEffect(() => {
    return clearCloseTimer;
  }, [clearCloseTimer]);

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
