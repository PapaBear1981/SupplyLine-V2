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

// Mock API hooks
vi.mock('@features/tools/services/toolsApi', () => ({
  useGetToolsQuery: () => ({
    data: { tools: [], total: 0 },
    isLoading: false,
  }),
}));

vi.mock('@features/chemicals/services/chemicalsApi', () => ({
  useGetChemicalsQuery: () => ({
    data: { chemicals: [], pagination: { total: 0 } },
    isLoading: false,
  }),
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
});
