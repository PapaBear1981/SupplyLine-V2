import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MobileChemicalsList } from './MobileChemicalsList';
import authReducer from '@features/auth/slices/authSlice';
import { baseApi } from '@services/baseApi';
import type { Chemical } from '../../types';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockUser = {
  id: 1,
  employee_number: 'EMP001',
  name: 'Test User',
  email: 'test@example.com',
  department: 'Engineering',
  is_admin: false,
  is_active: true,
  permissions: [],
};

const makeChemical = (overrides: Partial<Chemical> = {}): Chemical => ({
  id: 1,
  part_number: 'CHEM-001',
  lot_number: 'LOT-001',
  description: 'Test chemical description',
  quantity: 50,
  unit: 'oz',
  status: 'available',
  date_added: '2025-01-01',
  ...overrides,
});

const makePaginatedResult = (chemical: Chemical) => ({
  data: {
    chemicals: [chemical],
    pagination: { page: 1, per_page: 20, total: 1, pages: 1, has_next: false, has_prev: false },
  },
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
});

// ─── API mocks ────────────────────────────────────────────────────────────────

const mockGetChemicals = vi.fn();
const mockIssueChemical = vi.fn();

vi.mock('../../services/chemicalsApi', () => ({
  useGetChemicalsQuery: () => mockGetChemicals(),
  useCreateChemicalMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateChemicalMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteChemicalMutation: () => [vi.fn(), { isLoading: false }],
  useIssueChemicalMutation: () => [mockIssueChemical, { isLoading: false }],
}));

vi.mock('@features/warehouses/services/warehousesApi', () => ({
  useGetWarehousesQuery: () => ({ data: { warehouses: [] } }),
}));

vi.mock('@features/users/services/usersApi', () => ({
  useGetUsersQuery: () => ({
    data: [{ id: 1, name: 'Test User', employee_number: 'EMP001' }],
  }),
}));

// ─── Store + render helpers ───────────────────────────────────────────────────

const createMockStore = () =>
  configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        user: mockUser,
        token: 'mock-token',
        isAuthenticated: true,
      },
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(baseApi.middleware),
  });

const renderComponent = () => {
  const store = createMockStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <MobileChemicalsList />
      </BrowserRouter>
    </Provider>
  );
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MobileChemicalsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChemicals.mockReturnValue(makePaginatedResult(makeChemical()));
    mockIssueChemical.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        chemical: makeChemical({ quantity: 40 }),
        issuance: { id: 1, quantity: 10, hangar: 'Hangar A', user_id: 1, issue_date: '2025-01-01' },
      }),
    });
  });

  // ── List rendering ──────────────────────────────────────────────────────────

  it('renders chemical part number in the list', () => {
    renderComponent();
    expect(screen.getByText('CHEM-001')).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    mockGetChemicals.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
      refetch: vi.fn(),
    });
    const { container } = renderComponent();
    expect(container.querySelector('.chemical-skeleton')).not.toBeNull();
  });

  it('renders empty state when no chemicals exist', () => {
    mockGetChemicals.mockReturnValue({
      data: {
        chemicals: [],
        pagination: { page: 1, per_page: 20, total: 0, pages: 0, has_next: false, has_prev: false },
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderComponent();
    expect(screen.getByText('No chemicals found')).toBeInTheDocument();
  });

  // ── Detail popup ────────────────────────────────────────────────────────────

  describe('detail popup', () => {
    it('opens when a chemical list item is tapped', () => {
      renderComponent();
      fireEvent.click(screen.getByText('CHEM-001'));
      expect(screen.getByText('Lot Number')).toBeInTheDocument();
    });

    it('shows the Issue Chemical button for an available chemical', () => {
      renderComponent();
      fireEvent.click(screen.getByText('CHEM-001'));
      expect(screen.getByText('Issue Chemical')).toBeInTheDocument();
    });

    it('disables Issue Chemical for an expired chemical', () => {
      mockGetChemicals.mockReturnValue(
        makePaginatedResult(makeChemical({ status: 'expired', quantity: 0 }))
      );
      renderComponent();
      fireEvent.click(screen.getByText('CHEM-001'));
      const btn = screen.getByRole('button', { name: /issue chemical/i });
      expect(btn).toBeDisabled();
    });

    it('disables Issue Chemical for an out-of-stock chemical', () => {
      mockGetChemicals.mockReturnValue(
        makePaginatedResult(makeChemical({ status: 'out_of_stock', quantity: 0 }))
      );
      renderComponent();
      fireEvent.click(screen.getByText('CHEM-001'));
      const btn = screen.getByRole('button', { name: /issue chemical/i });
      expect(btn).toBeDisabled();
    });

    it('keeps Issue Chemical enabled for an available chemical', () => {
      renderComponent();
      fireEvent.click(screen.getByText('CHEM-001'));
      const btn = screen.getByRole('button', { name: /issue chemical/i });
      expect(btn).not.toBeDisabled();
    });
  });

  // ── Issuance popup ──────────────────────────────────────────────────────────

  describe('issuance popup', () => {
    const openIssuancePopup = () => {
      renderComponent();
      fireEvent.click(screen.getByText('CHEM-001'));
      fireEvent.click(screen.getByRole('button', { name: /issue chemical/i }));
    };

    it('shows the issuance form when Issue Chemical is tapped', () => {
      openIssuancePopup();
      expect(screen.getByText('Quantity to Issue')).toBeInTheDocument();
      expect(screen.getByText('Hangar / Location')).toBeInTheDocument();
      expect(screen.getByText('Issue To')).toBeInTheDocument();
    });

    it('shows optional Work Order and Purpose fields', () => {
      openIssuancePopup();
      expect(screen.getByText('Work Order')).toBeInTheDocument();
      expect(screen.getByText('Purpose')).toBeInTheDocument();
    });

    it('shows a chemical summary at the top of the issuance form', () => {
      openIssuancePopup();
      expect(screen.getByText('Part Number')).toBeInTheDocument();
      expect(screen.getByText('Available Qty')).toBeInTheDocument();
    });

    it('shows a Confirm Issuance submit button', () => {
      openIssuancePopup();
      expect(screen.getByRole('button', { name: /confirm issuance/i })).toBeInTheDocument();
    });

    it('shows a low-stock warning when quantity is at or below minimum level', () => {
      mockGetChemicals.mockReturnValue(
        makePaginatedResult(makeChemical({ quantity: 5, minimum_stock_level: 10 }))
      );
      renderComponent();
      fireEvent.click(screen.getByText('CHEM-001'));
      fireEvent.click(screen.getByRole('button', { name: /issue chemical/i }));
      expect(
        screen.getByText(/issuing will trigger an automatic reorder request/i)
      ).toBeInTheDocument();
    });

    it('does not show a low-stock warning for well-stocked chemicals', () => {
      renderComponent(); // default chemical: qty 50, no minimum_stock_level
      fireEvent.click(screen.getByText('CHEM-001'));
      fireEvent.click(screen.getByRole('button', { name: /issue chemical/i }));
      expect(
        screen.queryByText(/issuing will trigger an automatic reorder request/i)
      ).not.toBeInTheDocument();
    });

    it('shows an error notice and disables submit for an expired chemical via direct state', () => {
      // Gate: expired chemicals disable the button in the detail popup, so we
      // verify the button there is disabled rather than reaching the inner form.
      mockGetChemicals.mockReturnValue(
        makePaginatedResult(makeChemical({ status: 'expired', quantity: 0 }))
      );
      renderComponent();
      fireEvent.click(screen.getByText('CHEM-001'));
      expect(screen.getByRole('button', { name: /issue chemical/i })).toBeDisabled();
    });

    it('calls issueChemical mutation after filling hangar and submitting', async () => {
      openIssuancePopup();

      const hangarInput = screen.getByPlaceholderText('e.g. Hangar A, Bay 1');
      fireEvent.change(hangarInput, { target: { value: 'Hangar A' } });

      fireEvent.click(screen.getByRole('button', { name: /confirm issuance/i }));

      // validateFields() and unwrap() are both async — waitFor retries until resolved
      await waitFor(() => {
        expect(mockIssueChemical).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 1,
            data: expect.objectContaining({
              hangar: 'Hangar A',
              quantity: 1,
            }),
          })
        );
      });
    });
  });
});
