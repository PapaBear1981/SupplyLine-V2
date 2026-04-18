import { useEffect, useRef, useState, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popup, SafeArea, Toast, Button } from 'antd-mobile';
import { CloseOutline } from 'antd-mobile-icons';
import { BulbOutlined } from '@ant-design/icons';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useScannerLookupMutation } from '../services/scannerApi';
import { parseScannedCode } from '../utils/parseScannedCode';
import { useHaptics } from '@shared/hooks/useHaptics';
import type { ScannerResolution } from '../context/scannerHooks';
import './MobileScannerSheet.css';

interface MobileScannerSheetProps {
  visible: boolean;
  onClose: () => void;
  onResolved?: (result: ScannerResolution) => void;
  title?: string;
  accept?: Array<ScannerResolution['itemType']>;
}

const ROUTE_FOR_TYPE: Record<ScannerResolution['itemType'], (id: number) => string> = {
  tool: (id) => `/tools?selected=${id}`,
  chemical: (id) => `/chemicals?selected=${id}`,
  kit: (id) => `/kits/${id}`,
};

export const MobileScannerSheet = ({
  visible,
  onClose,
  onResolved,
  title = 'Scan QR / Barcode',
  accept,
}: MobileScannerSheetProps) => {
  const navigate = useNavigate();
  const haptics = useHaptics();
  const [scannerLookup] = useScannerLookupMutation();

  // Unique DOM id — html5-qrcode attaches to a DOM element by id.
  const reactId = useId();
  const elementId = `scanner-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  // Tracks whether the sheet is still visible, so handleDecoded can bail
  // out after an async await (backend lookup, camera stop) if the user
  // dismissed the sheet while the lookup was in flight. Without this
  // guard, late resolutions would still call onResolved / navigate().
  const isVisibleRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // ---- Start / stop camera when the sheet opens / closes ------------------
  useEffect(() => {
    if (!visible) {
      isVisibleRef.current = false;
      return;
    }
    isVisibleRef.current = true;

    let cancelled = false;
    const startCamera = async () => {
      setError(null);
      setCameraReady(false);
      busyRef.current = false;

      try {
        const scanner = new Html5Qrcode(elementId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
          ],
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const min = Math.min(viewfinderWidth, viewfinderHeight);
              const edge = Math.floor(min * 0.75);
              return { width: edge, height: edge };
            },
          },
          async (decoded: string) => {
            if (busyRef.current || cancelled) return;
            busyRef.current = true;
            haptics.trigger('success');
            await handleDecoded(decoded);
          },
          () => {
            // Ignore per-frame decode errors
          }
        );

        if (cancelled) {
          await scanner.stop().catch(() => {});
          return;
        }

        setCameraReady(true);

        // Probe torch support
        try {
          const caps = scanner.getRunningTrackCameraCapabilities();
          setTorchSupported(Boolean(caps?.torchFeature?.()?.isSupported?.()));
        } catch {
          setTorchSupported(false);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Camera unavailable on this device.';
        setError(msg);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
      setTorchOn(false);
      setTorchSupported(false);
      setCameraReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ---- Torch toggle -------------------------------------------------------
  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      const caps = scanner.getRunningTrackCameraCapabilities();
      const torch = caps?.torchFeature?.();
      if (!torch?.isSupported?.()) {
        Toast.show({ content: 'Torch unavailable on this camera' });
        return;
      }
      const next = !torchOn;
      await torch.apply(next);
      setTorchOn(next);
    } catch {
      Toast.show({ icon: 'fail', content: 'Could not toggle torch' });
    }
  };

  // ---- Scan resolution ----------------------------------------------------
  const handleDecoded = async (decoded: string) => {
    const parsed = parseScannedCode(decoded);

    try {
      let resolution: ScannerResolution | null = null;

      if (parsed.kind === 'local') {
        resolution = {
          itemType: parsed.itemType,
          itemId: parsed.itemId,
        };
      } else {
        // Backend lookup — the user may dismiss the sheet during this
        // network request, so we re-check isVisibleRef afterwards.
        const result = await scannerLookup({ code: parsed.code }).unwrap();
        if (!isVisibleRef.current) return;
        resolution = {
          itemType: result.item_type,
          itemId: result.item_id,
          itemData: result.item_data,
          warning: result.warning,
        };
      }

      if (accept && !accept.includes(resolution.itemType)) {
        Toast.show({
          icon: 'fail',
          content: `Expected ${accept.join(' or ')}, scanned ${resolution.itemType}`,
        });
        haptics.trigger('error');
        // Allow re-scan after a moment
        window.setTimeout(() => {
          busyRef.current = false;
        }, 800);
        return;
      }

      if (resolution.warning) {
        Toast.show({
          icon: 'loading',
          content: resolution.warning,
          duration: 1500,
        });
      }

      // Stop scanning before triggering the callback / navigation. This
      // is another async boundary — re-check the visibility ref so a
      // very-late camera-stop doesn't fire navigate() after onClose().
      const scanner = scannerRef.current;
      if (scanner && scanner.isScanning) {
        await scanner.stop().catch(() => {});
      }
      if (!isVisibleRef.current) return;

      if (onResolved) {
        onResolved(resolution);
      } else {
        navigate(ROUTE_FOR_TYPE[resolution.itemType](resolution.itemId));
      }

      onClose();
    } catch (err) {
      if (!isVisibleRef.current) return;
      haptics.trigger('error');
      const msg =
        (err as { data?: { error?: string } })?.data?.error ??
        'No matching item found for that code.';
      Toast.show({ icon: 'fail', content: msg, duration: 2000 });
      // Allow re-scan after the toast
      window.setTimeout(() => {
        busyRef.current = false;
      }, 1500);
    }
  };

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{
        height: '100vh',
        background: '#000',
        color: '#fff',
      }}
      destroyOnClose
    >
      <div className="mobile-scanner-sheet">
        <SafeArea position="top" />
        <div className="mobile-scanner-sheet__header">
          <button
            type="button"
            className="mobile-scanner-sheet__close"
            onClick={onClose}
            aria-label="Close scanner"
          >
            <CloseOutline fontSize={24} />
          </button>
          <div className="mobile-scanner-sheet__title">{title}</div>
          {torchSupported ? (
            <button
              type="button"
              className={`mobile-scanner-sheet__torch ${torchOn ? 'active' : ''}`}
              onClick={toggleTorch}
              aria-label="Toggle torch"
            >
              <BulbOutlined style={{ fontSize: 22 }} />
            </button>
          ) : (
            <div style={{ width: 40 }} />
          )}
        </div>

        <div id={elementId} className="mobile-scanner-sheet__viewport" />

        {!cameraReady && !error && (
          <div className="mobile-scanner-sheet__placeholder">Starting camera…</div>
        )}

        {error && (
          <div className="mobile-scanner-sheet__error">
            <div className="mobile-scanner-sheet__error-title">Camera unavailable</div>
            <div className="mobile-scanner-sheet__error-body">{error}</div>
            <Button color="primary" onClick={onClose} style={{ marginTop: 16 }}>
              Close
            </Button>
          </div>
        )}

        {cameraReady && !error && (
          <div className="mobile-scanner-sheet__hint">
            Point the camera at a label's QR code or barcode
          </div>
        )}

        <SafeArea position="bottom" />
      </div>
    </Popup>
  );
};
