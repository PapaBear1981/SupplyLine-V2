import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

describe('useGeolocation', () => {
  const originalGeolocation = (navigator as unknown as { geolocation?: unknown })
    .geolocation;

  beforeEach(() => {
    (navigator as unknown as { geolocation: Geolocation }).geolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    } as unknown as Geolocation;
  });

  afterEach(() => {
    if (originalGeolocation === undefined) {
      delete (navigator as unknown as { geolocation?: unknown }).geolocation;
    } else {
      (navigator as unknown as { geolocation: unknown }).geolocation =
        originalGeolocation;
    }
  });

  it('resolves with coordinates on success', async () => {
    const fakePosition = {
      coords: { latitude: 45.5, longitude: -122.6, accuracy: 10 },
      timestamp: 1700000000000,
    };
    (navigator.geolocation.getCurrentPosition as ReturnType<typeof vi.fn>)
      .mockImplementation((success: PositionCallback) => {
        success(fakePosition as GeolocationPosition);
      });

    const { result } = renderHook(() => useGeolocation());

    let response: Awaited<ReturnType<typeof result.current.capture>> | undefined;
    await act(async () => {
      response = await result.current.capture();
    });

    expect(response).toEqual({
      latitude: 45.5,
      longitude: -122.6,
      accuracy: 10,
      timestamp: 1700000000000,
    });
    expect(result.current.error).toBeNull();
  });

  it('resolves to null and records error when the user denies permission', async () => {
    const deniedError = { code: 1, message: 'User denied geolocation' };
    (navigator.geolocation.getCurrentPosition as ReturnType<typeof vi.fn>)
      .mockImplementation((_success: PositionCallback, error: PositionErrorCallback) => {
        error(deniedError as GeolocationPositionError);
      });

    const { result } = renderHook(() => useGeolocation());

    let response: Awaited<ReturnType<typeof result.current.capture>> | undefined;
    await act(async () => {
      response = await result.current.capture();
    });

    expect(response).toBeNull();
    expect(result.current.error).toEqual({
      code: 1,
      message: 'User denied geolocation',
    });
  });

  it('reports unavailable when geolocation is missing', async () => {
    delete (navigator as unknown as { geolocation?: unknown }).geolocation;

    const { result } = renderHook(() => useGeolocation());
    expect(result.current.isAvailable).toBe(false);

    let response: Awaited<ReturnType<typeof result.current.capture>> | undefined;
    await act(async () => {
      response = await result.current.capture();
    });

    expect(response).toBeNull();
    expect(result.current.error?.message).toMatch(/not supported/i);
  });
});
