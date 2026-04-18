import { useCallback, useState } from 'react';

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface UseGeolocationResult {
  /** Fetch the current GPS position. Resolves to null on denial / error. */
  capture: () => Promise<GeolocationResult | null>;
  /** True while a capture is in flight. */
  capturing: boolean;
  /** Most recent error (null if none). */
  error: GeolocationError | null;
  /** Whether the Geolocation API is available at all. */
  isAvailable: boolean;
}

/**
 * Lightweight geolocation hook that lets mobile forms capture GPS
 * coordinates before submitting (kit issuance, kit location updates,
 * on-site check-ins, etc.). Returns null instead of throwing when the
 * user denies permission so callers can proceed without location.
 */
export function useGeolocation(): UseGeolocationResult {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<GeolocationError | null>(null);

  const isAvailable =
    typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const capture = useCallback(() => {
    if (!isAvailable) {
      setError({ code: -1, message: 'Geolocation is not supported on this device.' });
      return Promise.resolve<GeolocationResult | null>(null);
    }

    setCapturing(true);
    setError(null);

    return new Promise<GeolocationResult | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCapturing(false);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (err) => {
          setCapturing(false);
          setError({ code: err.code, message: err.message });
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 60_000,
        }
      );
    });
  }, [isAvailable]);

  return { capture, capturing, error, isAvailable };
}
