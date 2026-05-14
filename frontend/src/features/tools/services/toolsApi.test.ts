import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@services/baseApi';
import authReducer from '@features/auth/slices/authSlice';
import { toolsApi, unwrapToolCalibrations } from './toolsApi';
import type { ToolCalibration } from '../types';

const cal = (id: number): ToolCalibration =>
  ({
    id,
    tool_id: 1,
    calibration_date: '2026-01-01T00:00:00Z',
    next_calibration_date: '2027-01-01T00:00:00Z',
    performed_by_user_id: 1,
    calibration_status: 'pass',
  }) as unknown as ToolCalibration;

describe('unwrapToolCalibrations', () => {
  it('extracts calibrations array from the wrapped backend response', () => {
    const wrapped = {
      calibrations: [cal(1), cal(2)],
      pagination: { page: 1, limit: 50, total: 2, pages: 1 },
    };
    expect(unwrapToolCalibrations(wrapped)).toEqual(wrapped.calibrations);
  });

  it('returns an empty array when the wrapped response has no records', () => {
    expect(
      unwrapToolCalibrations({ calibrations: [], pagination: {} })
    ).toEqual([]);
  });

  it('passes a bare array through unchanged', () => {
    const arr = [cal(1)];
    expect(unwrapToolCalibrations(arr)).toBe(arr);
  });

  it('returns an empty array when the calibrations key is missing', () => {
    expect(
      unwrapToolCalibrations({} as unknown as { calibrations: ToolCalibration[] })
    ).toEqual([]);
  });
});

/**
 * The "Record Calibration" workflow in the tool details drawer hits the
 * backend `POST /api/tools/{id}/calibrations` route, which expects a JSON
 * body (see `request.get_json()` in routes_calibration.py). An earlier
 * version of this mutation sent a FormData body, which the route silently
 * coerced to {} and rejected with a validation error. These tests pin the
 * wire format so a future refactor doesn't regress that.
 */
describe('toolsApi mutations — record calibration workflow', () => {
  const fetchSpy = vi.fn();

  const makeStore = () =>
    configureStore({
      reducer: {
        [baseApi.reducerPath]: baseApi.reducer,
        auth: authReducer,
      },
      middleware: (getDefault) =>
        getDefault({ serializableCheck: false }).concat(baseApi.middleware),
    });

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('addToolCalibration POSTs JSON to /api/tools/:id/calibrations', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: 'ok', calibration: { id: 42 } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const store = makeStore();
    const result = await store.dispatch(
      toolsApi.endpoints.addToolCalibration.initiate({
        toolId: 7,
        data: {
          calibration_date: '2026-05-01T00:00:00.000Z',
          next_calibration_date: '2026-11-01T00:00:00.000Z',
          calibration_status: 'pass',
          notes: 'Annual',
        },
      })
    );

    expect('error' in result && result.error).toBeFalsy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const request = fetchSpy.mock.calls[0][0] as Request;
    expect(request.url).toContain('/api/tools/7/calibrations');
    expect(request.method).toBe('POST');
    expect(request.headers.get('Content-Type')).toBe('application/json');

    const body = await request.clone().json();
    expect(body).toEqual({
      calibration_date: '2026-05-01T00:00:00.000Z',
      next_calibration_date: '2026-11-01T00:00:00.000Z',
      calibration_status: 'pass',
      notes: 'Annual',
    });
  });

  it('uploadCalibrationCertificate POSTs multipart form-data to the cert endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: 'ok', certificate: 'cert.pdf' }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const store = makeStore();
    const file = new File([new Uint8Array([1, 2, 3])], 'cert.pdf', {
      type: 'application/pdf',
    });

    const result = await store.dispatch(
      toolsApi.endpoints.uploadCalibrationCertificate.initiate({
        calibrationId: 99,
        toolId: 7,
        file,
      })
    );

    expect('error' in result && result.error).toBeFalsy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const request = fetchSpy.mock.calls[0][0] as Request;
    expect(request.url).toContain('/api/calibrations/99/certificate');
    expect(request.method).toBe('POST');

    // FormData is sent as multipart, not JSON. The browser sets the boundary
    // automatically — Content-Type starts with multipart/form-data.
    const ct = request.headers.get('Content-Type') ?? '';
    expect(ct.startsWith('multipart/form-data')).toBe(true);

    const body = await request.clone().text();
    expect(body).toContain('name="certificate"');
    // In jsdom/undici the File instance is downgraded to a Blob while
    // serializing the Request, so the filename may round-trip as "blob" in
    // tests even though browsers preserve file.name.
    expect(body).toContain('filename=');
    expect(body).toContain('Content-Type: application/pdf');
  });
});
