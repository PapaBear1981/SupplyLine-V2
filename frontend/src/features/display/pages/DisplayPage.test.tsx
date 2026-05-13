import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { Kit, KitToolCheckout } from '@features/kits/types';

type WarehouseState = { id: number | null; name: string | null };
let mockWarehouse: WarehouseState = { id: 1, name: 'Hangar 1' };

const kitsSpy = vi.fn<
  (params?: unknown, options?: { pollingInterval?: number }) =>
    { data: Kit[] | undefined; isLoading: boolean }
>();

const checkoutsSpy = vi.fn<
  (
    params?: { warehouse_id?: number },
    options?: { skip?: boolean; pollingInterval?: number }
  ) => { data: { checkouts: KitToolCheckout[]; total: number } | undefined }
>();

vi.mock('@features/kits/services/kitsApi', () => ({
  useGetKitsQuery: (params: unknown, options: { pollingInterval?: number }) =>
    kitsSpy(params, options),
  useGetActiveKitToolCheckoutsQuery: (
    params: { warehouse_id?: number },
    options: { skip?: boolean; pollingInterval?: number }
  ) => checkoutsSpy(params, options),
  useGetKitLocationsQuery: () => ({ data: { kits: [] }, isLoading: false, refetch: vi.fn() }),
  useGetAircraftTypesQuery: () => ({ data: [] }),
}));

// The map is a heavy Leaflet component; stub it for unit tests so the kit
// grid behaviour stays the focus.
vi.mock('@features/kits/components/KitLocationMap', () => ({
  KitLocationMap: () => null,
}));

vi.mock('@features/warehouses/hooks/useActiveWarehouse', () => ({
  useActiveWarehouse: () => ({
    activeWarehouseId: mockWarehouse.id,
    activeWarehouseName: mockWarehouse.name,
    setActiveWarehouse: vi.fn(),
    isChanging: false,
    error: undefined,
  }),
}));

vi.mock('@features/admin/services/oncallApi', () => ({
  useGetOnCallPersonnelQuery: () => ({
    data: {
      materials: { user: null, updated_at: null, updated_by: null },
      maintenance: { user: null, updated_at: null, updated_by: null },
    },
  }),
}));

vi.mock('@features/admin/services/adminApi', () => ({
  useGetActiveAnnouncementsQuery: () => ({ data: [] }),
}));

import { DisplayPage } from './DisplayPage';

const kit = (over: Partial<Kit>): Kit => ({
  id: over.id ?? 0,
  name: over.name ?? 'Kit',
  aircraft_type_id: 1,
  aircraft_type_name: 'F-35A',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  created_by: 1,
  ...over,
});

const checkout = (over: Partial<KitToolCheckout>): KitToolCheckout => ({
  id: over.id ?? 0,
  tool_id: over.tool_id ?? 100,
  tool_number: over.tool_number ?? 'T-100',
  tool_description: over.tool_description ?? 'Tool',
  kit_id: over.kit_id ?? 1,
  checked_out_by_id: 1,
  checkout_date: '2026-05-01T00:00:00Z',
  status: 'active',
  ...over,
});

const renderPage = () =>
  render(
    <BrowserRouter>
      <DisplayPage />
    </BrowserRouter>
  );

describe('DisplayPage', () => {
  beforeEach(() => {
    mockWarehouse = { id: 1, name: 'Hangar 1' };
    kitsSpy.mockReset();
    checkoutsSpy.mockReset();
    kitsSpy.mockReturnValue({ data: [], isLoading: false });
    checkoutsSpy.mockReturnValue({ data: { checkouts: [], total: 0 } });
  });

  it('renders the brand title and active warehouse name', () => {
    renderPage();

    expect(screen.getByText('SupplyLine Field Kits')).toBeInTheDocument();
    expect(screen.getByText('Hangar 1')).toBeInTheDocument();
  });

  it('shows a "no warehouse" empty state and skips the checkouts query', () => {
    mockWarehouse = { id: null, name: null };

    renderPage();

    expect(
      screen.getByText(/No active warehouse selected/)
    ).toBeInTheDocument();
    const [, options] = checkoutsSpy.mock.calls[0];
    expect(options?.skip).toBe(true);
  });

  it('shows the loading state while kits are being fetched', () => {
    kitsSpy.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getByText(/Loading kits/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no visible kits', () => {
    kitsSpy.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByText('No active kits.')).toBeInTheDocument();
  });

  it('filters out retired and inactive kits and renders the rest', () => {
    kitsSpy.mockReturnValue({
      data: [
        kit({ id: 1, name: 'Active Alpha', status: 'active' }),
        kit({ id: 2, name: 'Retired Bravo', status: 'retired' }),
        kit({ id: 3, name: 'Inactive Charlie', status: 'inactive' }),
        kit({ id: 4, name: 'Deployed Delta', status: 'deployed' }),
      ],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Active Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deployed Delta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Retired Bravo' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Inactive Charlie' })
    ).not.toBeInTheDocument();
  });

  it('groups checkouts by kit and orders kits by deployed-tool count desc', () => {
    kitsSpy.mockReturnValue({
      data: [
        kit({ id: 1, name: 'Few Tools' }),
        kit({ id: 2, name: 'Many Tools' }),
        kit({ id: 3, name: 'No Tools' }),
      ],
      isLoading: false,
    });
    checkoutsSpy.mockReturnValue({
      data: {
        checkouts: [
          checkout({ id: 11, kit_id: 1, tool_number: 'A-1' }),
          checkout({ id: 21, kit_id: 2, tool_number: 'B-1' }),
          checkout({ id: 22, kit_id: 2, tool_number: 'B-2' }),
          checkout({ id: 23, kit_id: 2, tool_number: 'B-3' }),
        ],
        total: 4,
      },
    });

    renderPage();

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['Many Tools', 'Few Tools', 'No Tools']);

    // Each kit shows its own checkouts.
    expect(screen.getByText('B-1')).toBeInTheDocument();
    expect(screen.getByText('A-1')).toBeInTheDocument();
  });

  it('passes the active warehouse id and 30s polling to the checkouts query', () => {
    mockWarehouse = { id: 42, name: 'Hangar 42' };

    renderPage();

    const [params, options] = checkoutsSpy.mock.calls[0];
    expect(params?.warehouse_id).toBe(42);
    expect(options?.skip).toBe(false);
    expect(options?.pollingInterval).toBe(30_000);

    const [, kitsOptions] = kitsSpy.mock.calls[0];
    expect(kitsOptions?.pollingInterval).toBe(30_000);
  });
});
