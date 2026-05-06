import { describe, it, expect } from 'vitest';
import { unwrapToolCalibrations } from './toolsApi';
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
