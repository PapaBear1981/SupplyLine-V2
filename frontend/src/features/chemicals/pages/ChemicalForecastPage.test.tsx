import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChemicalForecastPage } from './ChemicalForecastPage';

const mockUseGetChemicalForecastQuery = vi.fn();

vi.mock('../services/chemicalsApi', () => ({
  useGetChemicalForecastQuery: (params: unknown) => mockUseGetChemicalForecastQuery(params),
}));

vi.mock('@features/orders/services/requestsApi', () => ({
  useCreateRequestMutation: () => [vi.fn(), { isLoading: false }],
}));

describe('ChemicalForecastPage', () => {
  it('does not render the forecast footer when parameters are missing', () => {
    mockUseGetChemicalForecastQuery.mockReturnValue({
      data: {
        forecasts: [],
        summary: {
          critical: 0,
          reorder_soon: 0,
          expiry_risk: 0,
          ok: 0,
          no_history: 0,
          total_waste_risk_qty: 0,
        },
        generated_at: null,
      },
      isFetching: false,
      refetch: vi.fn(),
      error: undefined,
    });

    render(<ChemicalForecastPage />);

    expect(screen.queryByText(/Based on/i)).not.toBeInTheDocument();
  });

  it('renders the forecast footer even when generated_at is null', () => {
    mockUseGetChemicalForecastQuery.mockReturnValue({
      data: {
        forecasts: [],
        summary: {
          critical: 0,
          reorder_soon: 0,
          expiry_risk: 0,
          ok: 0,
          no_history: 0,
          total_waste_risk_qty: 0,
        },
        parameters: {
          analysis_window_days: 90,
          lead_time_days: 14,
          safety_stock_days: 14,
        },
        generated_at: null,
      },
      isFetching: false,
      refetch: vi.fn(),
      error: undefined,
    });

    render(<ChemicalForecastPage />);

    expect(screen.getByText(/Based on 90-day consumption history/i)).toBeInTheDocument();
  });
});
