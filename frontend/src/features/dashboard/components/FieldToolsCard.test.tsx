import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { FieldToolsCard } from './FieldToolsCard';

const activeKitToolCheckoutsSpy = vi.fn(() => ({
  data: { checkouts: [], total: 0 },
  isLoading: false,
}));

vi.mock('@features/kits/services/kitsApi', () => ({
  useGetActiveKitToolCheckoutsQuery: (...args: unknown[]) =>
    activeKitToolCheckoutsSpy(...args),
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
    const [params, options] = activeKitToolCheckoutsSpy.mock.calls[0] as [
      { warehouse_id?: number },
      { skip?: boolean } | undefined,
    ];
    expect(params.warehouse_id).toBe(7);
    expect(options?.skip).toBe(false);
  });

  it('skips the query when no warehouse is selected', () => {
    mockActiveWarehouseId = null;
    renderCard();

    const [params, options] = activeKitToolCheckoutsSpy.mock.calls[0] as [
      { warehouse_id?: number },
      { skip?: boolean } | undefined,
    ];
    expect(params.warehouse_id).toBeUndefined();
    expect(options?.skip).toBe(true);
  });

  it('renders the empty state when no checkouts are returned', () => {
    renderCard();
    expect(
      screen.getByText('No tools currently deployed to field kits')
    ).toBeInTheDocument();
  });
});
