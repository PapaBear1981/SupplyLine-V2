import type { Page } from '@playwright/test';
import { installApiMocks } from './api-mocks';

/**
 * Deterministic forecast fixture used by chemicals-forecast specs.
 * Kept in a dedicated file so the same payload can be reused by future
 * mobile / tablet forecast coverage.
 */
export const MOCK_FORECAST_RESPONSE = {
  forecasts: [
    {
      part_number: 'AMS-1525-A',
      description: 'Corrosion Inhibitor',
      manufacturer: 'Loctite',
      lot_count: 2,
      current_quantity: 8,
      unit: 'qt',
      daily_consumption_rate: 0.45,
      weekly_consumption_rate: 3.15,
      net_issued_in_window: 40.5,
      analysis_window_days: 90,
      days_of_stock_remaining: 17,
      projected_depletion_date: '2026-04-27',
      earliest_expiry_date: '2026-06-15',
      days_until_expiry: 66,
      waste_risk_quantity: 0,
      urgency: 'critical',
      recommended_order_quantity: 25,
      needs_reorder: true,
      current_reorder_status: null,
      chemical_ids: [1, 2],
    },
    {
      part_number: 'MIL-PRF-23827',
      description: 'Grease, Aircraft and Instrument',
      manufacturer: 'Royco',
      lot_count: 1,
      current_quantity: 45,
      unit: 'lb',
      daily_consumption_rate: 0.28,
      weekly_consumption_rate: 1.96,
      net_issued_in_window: 25.2,
      analysis_window_days: 90,
      days_of_stock_remaining: 160,
      projected_depletion_date: '2026-09-17',
      earliest_expiry_date: '2026-05-30',
      days_until_expiry: 50,
      waste_risk_quantity: 3.6,
      urgency: 'expiry_risk',
      recommended_order_quantity: null,
      needs_reorder: false,
      current_reorder_status: null,
      chemical_ids: [3],
    },
    {
      part_number: 'AMS-3276',
      description: 'Sealant, Polysulfide',
      manufacturer: 'PRC-DeSoto',
      lot_count: 3,
      current_quantity: 120,
      unit: 'oz',
      daily_consumption_rate: 0.91,
      weekly_consumption_rate: 6.37,
      net_issued_in_window: 82,
      analysis_window_days: 90,
      days_of_stock_remaining: 131,
      projected_depletion_date: null,
      earliest_expiry_date: null,
      days_until_expiry: null,
      waste_risk_quantity: 0,
      urgency: 'ok',
      recommended_order_quantity: null,
      needs_reorder: false,
      current_reorder_status: null,
      chemical_ids: [4, 5, 6],
    },
  ],
  summary: {
    total_part_numbers: 3,
    critical: 1,
    reorder_soon: 0,
    expiry_risk: 1,
    ok: 1,
    no_history: 0,
    total_waste_risk_qty: 3.6,
  },
  parameters: {
    analysis_window_days: 90,
    lead_time_days: 14,
    safety_stock_days: 14,
  },
  generated_at: new Date().toISOString(),
};

/**
 * Route-mock the forecast endpoint alongside the default auth/me + AI mocks.
 * The spec can then just call `goto('/chemicals/forecast')`.
 */
export async function mockAuthedForecast(page: Page): Promise<void> {
  await installApiMocks(page, [
    { urlIncludes: '/api/chemicals/forecast', response: MOCK_FORECAST_RESPONSE },
  ]);
}
