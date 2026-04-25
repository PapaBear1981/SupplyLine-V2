import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MobileDashboard } from './MobileDashboard';
import authReducer from '@features/auth/slices/authSlice';
import { baseApi } from '@services/baseApi';

// Mock user data
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

// Create mock store
const createMockStore = () => {
  return configureStore({
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
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(baseApi.middleware),
  });
};

// Mock API hooks — use vi.fn() so tests can assert the args the components pass.
type ToolsQueryParams = { per_page?: number; warehouse_id?: number };
type ChemicalsQueryParams = { per_page?: number; warehouse_id?: number };
type QueryOptions = { skip?: boolean };
type UseGetToolsQueryFn = (
  params?: ToolsQueryParams,
  options?: QueryOptions,
) => { data: { tools: unknown[]; total: number }; isLoading: boolean };
type UseGetChemicalsQueryFn = (
  params?: ChemicalsQueryParams,
  options?: QueryOptions,
) => {
  data: { chemicals: unknown[]; pagination: { total: number } };
  isLoading: boolean;
};

const toolsQuerySpy = vi.fn<UseGetToolsQueryFn>();
toolsQuerySpy.mockReturnValue({
  data: { tools: [], total: 0 },
  isLoading: false,
});
const chemicalsQuerySpy = vi.fn<UseGetChemicalsQueryFn>();
chemicalsQuerySpy.mockReturnValue({
  data: { chemicals: [], pagination: { total: 0 } },
  isLoading: false,
});

vi.mock('@features/tools/services/toolsApi', () => ({
  useGetToolsQuery: (params?: ToolsQueryParams, options?: QueryOptions) =>
    toolsQuerySpy(params, options),
}));

vi.mock('@features/chemicals/services/chemicalsApi', () => ({
  useGetChemicalsQuery: (
    params?: ChemicalsQueryParams,
    options?: QueryOptions,
  ) => chemicalsQuerySpy(params, options),
}));

vi.mock('@features/kits/services/kitsApi', () => ({
  useGetKitsQuery: () => ({
    data: [],
    isLoading: false,
  }),
  useGetRecentKitActivityQuery: () => ({
    data: [],
    isLoading: false,
  }),
  useGetReorderReportQuery: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock('@features/warehouses/services/warehousesApi', () => ({
  useGetWarehousesQuery: () => ({
    data: { warehouses: [] },
    isLoading: false,
  }),
}));

vi.mock('@features/admin/services/adminApi', () => ({
  useGetAnnouncementsQuery: () => ({
    data: [],
    isLoading: false,
  }),
}));

// MobileKitLocationMap pulls in react-leaflet + useTheme from ThemeContext,
// both of which are too heavy for a unit test to render. Mock it out.
vi.mock('@features/kits/components/mobile', () => ({
  MobileKitLocationMap: () => <div data-testid="kit-location-map" />,
}));

// The active warehouse picker has its own RTK Query + popup logic that is
// covered by its own tests. Stub it here so the dashboard tests stay focused.
vi.mock('@features/warehouses/components/mobile', () => ({
  MobileActiveWarehouseSelect: ({ variant }: { variant?: string }) => (
    <div
      data-testid="mobile-active-warehouse-stub"
      data-variant={variant}
    />
  ),
}));

// Mock useActiveWarehouse so tests can drive the active warehouse ID.
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

const renderWithProviders = (component: React.ReactNode) => {
  const store = createMockStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('MobileDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveWarehouseId = 1;
  });

  it('should render welcome message with user name', () => {
    renderWithProviders(<MobileDashboard />);

    expect(screen.getByText(/Welcome back, Test/)).toBeInTheDocument();
  });

  it('should render inventory overview section', () => {
    renderWithProviders(<MobileDashboard />);

    expect(screen.getByText('Inventory Overview')).toBeInTheDocument();
  });

  it('should render stat cards for tools, chemicals, kits, warehouses', () => {
    renderWithProviders(<MobileDashboard />);

    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Chemicals')).toBeInTheDocument();
    expect(screen.getByText('Kits')).toBeInTheDocument();
    expect(screen.getByText('Warehouses')).toBeInTheDocument();
  });

  it('should render alerts section', () => {
    renderWithProviders(<MobileDashboard />);

    expect(screen.getByText('Alerts & Warnings')).toBeInTheDocument();
  });

  it('should render the kit location map section', () => {
    renderWithProviders(<MobileDashboard />);

    // Section header + the mocked MobileKitLocationMap placeholder
    expect(screen.getByText('Kit Locations')).toBeInTheDocument();
    expect(screen.getByTestId('kit-location-map')).toBeInTheDocument();
  });

  it('should render quick actions section', () => {
    renderWithProviders(<MobileDashboard />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('should render recent activity section', () => {
    renderWithProviders(<MobileDashboard />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('should render current date', () => {
    renderWithProviders(<MobileDashboard />);

    // Check that some date is shown (dynamic content)
    const dateRegex = /\w+,\s\w+\s\d+/; // Matches "Monday, January 1" format
    const dateElement = screen.getByText(dateRegex);
    expect(dateElement).toBeInTheDocument();
  });

  it('should show quick action buttons', () => {
    renderWithProviders(<MobileDashboard />);

    expect(screen.getByText('Check Out Tool')).toBeInTheDocument();
    expect(screen.getByText('New Order')).toBeInTheDocument();
    expect(screen.getByText('New Kit')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  describe('active warehouse scoping', () => {
    it('passes the active warehouse id to the tools query', () => {
      mockActiveWarehouseId = 42;
      renderWithProviders(<MobileDashboard />);

      expect(toolsQuerySpy).toHaveBeenCalled();
      const [params, options] = toolsQuerySpy.mock.calls[0];
      expect(params?.warehouse_id).toBe(42);
      expect(options?.skip).toBe(false);
    });

    it('passes the active warehouse id to the chemicals query', () => {
      mockActiveWarehouseId = 42;
      renderWithProviders(<MobileDashboard />);

      expect(chemicalsQuerySpy).toHaveBeenCalled();
      const [params, options] = chemicalsQuerySpy.mock.calls[0];
      expect(params?.warehouse_id).toBe(42);
      expect(options?.skip).toBe(false);
    });

    it('skips the tools and chemicals queries when no warehouse is selected', () => {
      mockActiveWarehouseId = null;
      renderWithProviders(<MobileDashboard />);

      const [, toolsOptions] = toolsQuerySpy.mock.calls[0];
      const [, chemicalsOptions] = chemicalsQuerySpy.mock.calls[0];
      expect(toolsOptions?.skip).toBe(true);
      expect(chemicalsOptions?.skip).toBe(true);
    });

    it('renders the active warehouse picker on the dashboard', () => {
      mockActiveWarehouseId = null;
      renderWithProviders(<MobileDashboard />);

      const stub = screen.getByTestId('mobile-active-warehouse-stub');
      expect(stub).toBeInTheDocument();
      expect(stub).toHaveAttribute('data-variant', 'card');
    });
  });
});
