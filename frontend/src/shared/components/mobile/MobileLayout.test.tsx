import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MobileLayout } from './MobileLayout';
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
  permissions: ['page.tools', 'page.checkouts'],
};

// Create mock store
const createMockStore = (preloadedState = {}) => {
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
      ...preloadedState,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(baseApi.middleware),
  });
};

// Mock logout mutation
vi.mock('@features/auth/services/authApi', () => ({
  useLogoutMutation: () => [vi.fn().mockResolvedValue({}), { isLoading: false }],
}));

// Mock socket service
vi.mock('@services/socket', () => ({
  socketService: {
    disconnect: vi.fn(),
  },
}));

// Mobile admin toggle — default off; individual tests override as needed.
// The real hook returns { isEnabled, isLoading, isError }.
const mockMobileAdminEnabled = vi.fn(() => false);
vi.mock('@shared/hooks/useMobileAdminEnabled', () => ({
  useMobileAdminEnabled: () => ({
    isEnabled: mockMobileAdminEnabled(),
    isLoading: false,
    isError: false,
  }),
}));

// Scanner provider is mounted at the app root in production; tests mock the
// hook so MobileLayout can render without a surrounding ScannerProvider.
vi.mock('@features/scanner', () => ({
  useScanner: () => ({
    openScanner: vi.fn(),
    closeScanner: vi.fn(),
    isOpen: false,
  }),
}));

// MobileActiveWarehouseSelect pulls in its own RTK Query and slice. The
// MobileLayout tests don't exercise warehouse switching, so render a stub.
vi.mock('@features/warehouses/components/mobile', () => ({
  MobileActiveWarehouseSelect: () => (
    <div data-testid="mobile-active-warehouse-stub" />
  ),
}));

const renderWithProviders = (component: React.ReactNode, store = createMockStore()) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('MobileLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the mobile layout', () => {
    renderWithProviders(<MobileLayout />);

    // Check for tab bar items
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should show nav bar with current page title', () => {
    renderWithProviders(<MobileLayout />);

    // Default route should show Dashboard
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should have tab bar with navigation items', () => {
    const { container } = renderWithProviders(<MobileLayout />);

    // Check for tab bar class instead of role
    const tabBar = container.querySelector('.adm-tab-bar');
    expect(tabBar).toBeInTheDocument();
  });

  it('should open menu popup when Menu tab is clicked', () => {
    renderWithProviders(<MobileLayout />);

    const menuTab = screen.getAllByText('Menu')[0];
    fireEvent.click(menuTab);

    // Menu popup should open and show navigation items
    // The popup should contain the user info
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should show user info in menu popup', () => {
    renderWithProviders(<MobileLayout />);

    const menuTab = screen.getAllByText('Menu')[0];
    fireEvent.click(menuTab);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('should have logout option in menu', () => {
    renderWithProviders(<MobileLayout />);

    const menuTab = screen.getAllByText('Menu')[0];
    fireEvent.click(menuTab);

    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should show filtered menu items based on permissions', () => {
    renderWithProviders(<MobileLayout />);

    const menuTab = screen.getAllByText('Menu')[0];
    fireEvent.click(menuTab);

    // User has page.tools permission, so Tools should be visible
    expect(screen.getByText('Tools')).toBeInTheDocument();
    // User has page.checkouts permission, so Tool Checkout should be visible
    expect(screen.getByText('Tool Checkout')).toBeInTheDocument();
  });

  it('should expose Chemical Forecast when user has chemicals permission', () => {
    const storeWithChemicals = createMockStore({
      auth: {
        user: { ...mockUser, permissions: ['page.chemicals'] },
        token: 'mock-token',
        isAuthenticated: true,
      },
    });
    renderWithProviders(<MobileLayout />, storeWithChemicals);

    fireEvent.click(screen.getAllByText('Menu')[0]);
    expect(screen.getByText('Forecast')).toBeInTheDocument();
  });

  it('should hide Admin from non-admin users even when mobile admin is enabled', () => {
    mockMobileAdminEnabled.mockReturnValue(true);
    renderWithProviders(<MobileLayout />);

    fireEvent.click(screen.getAllByText('Menu')[0]);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    mockMobileAdminEnabled.mockReturnValue(false);
  });

  it('should hide Admin from admin users when mobile admin is disabled', () => {
    mockMobileAdminEnabled.mockReturnValue(false);
    const adminStore = createMockStore({
      auth: {
        user: { ...mockUser, is_admin: true },
        token: 'mock-token',
        isAuthenticated: true,
      },
    });
    renderWithProviders(<MobileLayout />, adminStore);

    fireEvent.click(screen.getAllByText('Menu')[0]);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('should show Admin for admin users when mobile admin is enabled', () => {
    mockMobileAdminEnabled.mockReturnValue(true);
    const adminStore = createMockStore({
      auth: {
        user: { ...mockUser, is_admin: true },
        token: 'mock-token',
        isAuthenticated: true,
      },
    });
    renderWithProviders(<MobileLayout />, adminStore);

    fireEvent.click(screen.getAllByText('Menu')[0]);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    mockMobileAdminEnabled.mockReturnValue(false);
  });
});
