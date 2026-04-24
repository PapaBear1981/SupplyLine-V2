import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { FieldToolsCard } from './FieldToolsCard';

type QueryParams = { warehouse_id?: number };
type QueryOptions = { skip?: boolean };
type UseActiveKitToolCheckoutsQueryFn = (
  params?: QueryParams,
  options?: QueryOptions,
) => { data: { checkouts: unknown[]; total: number }; isLoading: boolean };

const activeKitToolCheckoutsSpy = vi.fn<UseActiveKitToolCheckoutsQueryFn>();
activeKitToolCheckoutsSpy.mockReturnValue({
  data: { checkouts: [], total: 0 },
  isLoading: false,
});

vi.mock('@features/kits/services/kitsApi', () => ({
  useGetActiveKitToolCheckoutsQuery: (
    params?: QueryParams,
    options?: QueryOptions,
  ) => activeKitToolCheckoutsSpy(params, options),
}));

let mockActiveWarehouseId: number | null = 1;
vi.mock('@features/warehouses/hooks/useActiveWarehouse', () => ({
  useActiveWarehouse: () => ({
    activeWarehouseId: mockActiveWarehouseId,
    activeWarehouseName: mockActiveWarehouseId ? 'Test Warehouse' : null,
    setActiveWarehouse: vi.fn(),
    isChanging: false,
    error: undefined,
  }),
}));

const renderCard = () =>
  render(
    <BrowserRouter>
      <FieldToolsCard />
    </BrowserRouter>
  );

describe('FieldToolsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveWarehouseId = 1;
  });

  it('passes the active warehouse id to the active kit tool checkouts query', () => {
    mockActiveWarehouseId = 7;
    renderCard();

    expect(activeKitToolCheckoutsSpy).toHaveBeenCalled();
    const [params, options] = activeKitToolCheckoutsSpy.mock.calls[0];
    expect(params?.warehouse_id).toBe(7);
    expect(options?.skip).toBe(false);
  });

  it('skips the query when no warehouse is selected and shows the select-warehouse prompt', () => {
    mockActiveWarehouseId = null;
    renderCard();

    const [params, options] = activeKitToolCheckoutsSpy.mock.calls[0];
    expect(params?.warehouse_id).toBeUndefined();
    expect(options?.skip).toBe(true);
    expect(
      screen.getByText(/select an active warehouse/i)
    ).toBeInTheDocument();
  });

  it('renders the empty state when no checkouts are returned', () => {
    renderCard();
    expect(
      screen.getByText('No tools currently deployed to field kits')
    ).toBeInTheDocument();
  });
});
