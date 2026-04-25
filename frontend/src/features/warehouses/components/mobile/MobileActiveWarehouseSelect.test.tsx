import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { List } from 'antd-mobile';
import { MobileActiveWarehouseSelect } from './MobileActiveWarehouseSelect';
import authReducer from '@features/auth/slices/authSlice';
import activeWarehouseReducer from '../../slices/activeWarehouseSlice';
import { baseApi } from '@services/baseApi';

const setActiveWarehouseMock = vi.fn(async () => ({}));

let mockState = {
  activeWarehouseId: null as number | null,
  activeWarehouseName: null as string | null,
};

vi.mock('../../hooks/useActiveWarehouse', () => ({
  useActiveWarehouse: () => ({
    activeWarehouseId: mockState.activeWarehouseId,
    activeWarehouseName: mockState.activeWarehouseName,
    setActiveWarehouse: setActiveWarehouseMock,
    isChanging: false,
    error: undefined,
  }),
}));

const warehousesQuery = vi.fn(() => ({
  data: {
    warehouses: [
      { id: 1, name: 'Main Hangar', city: 'Seattle', state: 'WA', is_active: true },
      { id: 2, name: 'North Annex', city: 'Everett', state: 'WA', is_active: true },
      { id: 3, name: 'South Depot', city: 'Tacoma', state: 'WA', is_active: true },
    ],
  },
  isFetching: false,
  isLoading: false,
}));

vi.mock('../../services/warehousesApi', () => ({
  useGetWarehousesQuery: () => warehousesQuery(),
  warehousesApi: {},
}));

const mockUser = {
  id: 1,
  employee_number: 'EMP001',
  name: 'Test User',
  email: 'test@example.com',
  department: 'Engineering',
  is_admin: false,
  is_active: true,
  permissions: [],
  active_warehouse_id: null,
  active_warehouse_name: null,
};

const buildStore = () =>
  configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      activeWarehouse: activeWarehouseReducer,
    },
    preloadedState: {
      auth: {
        user: mockUser,
        token: 'mock-token',
        isAuthenticated: true,
      },
      activeWarehouse: {
        id: mockState.activeWarehouseId,
        name: mockState.activeWarehouseName,
      },
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(baseApi.middleware),
  });

const renderPicker = (variant: 'menu' | 'card' = 'menu') => {
  const store = buildStore();
  return render(
    <Provider store={store}>
      {variant === 'menu' ? (
        <List>
          <MobileActiveWarehouseSelect variant={variant} />
        </List>
      ) : (
        <MobileActiveWarehouseSelect variant={variant} />
      )}
    </Provider>
  );
};

describe('MobileActiveWarehouseSelect', () => {
  beforeEach(() => {
    setActiveWarehouseMock.mockClear();
    warehousesQuery.mockClear();
    mockState = { activeWarehouseId: null, activeWarehouseName: null };
  });

  it('shows the "pick one" warning when no warehouse is selected (menu variant)', () => {
    renderPicker('menu');

    expect(screen.getByText('Active Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('shows the current warehouse name when one is selected (menu variant)', () => {
    mockState = { activeWarehouseId: 2, activeWarehouseName: 'North Annex' };
    renderPicker('menu');

    expect(screen.getByText('North Annex')).toBeInTheDocument();
  });

  it('shows the picker as a card with "Not selected" when nothing is set', () => {
    renderPicker('card');

    expect(screen.getByText('Active Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Not selected')).toBeInTheDocument();
    expect(screen.getByText('Change')).toBeInTheDocument();
  });

  it('opens the picker popup and lists active warehouses when tapped', async () => {
    renderPicker('menu');

    const trigger = screen.getByTestId('mobile-active-warehouse-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('mobile-warehouse-picker')).toBeInTheDocument();
    });
    expect(screen.getByText('Main Hangar')).toBeInTheDocument();
    expect(screen.getByText('North Annex')).toBeInTheDocument();
    expect(screen.getByText('South Depot')).toBeInTheDocument();
  });

  it('calls setActiveWarehouse when a warehouse is chosen', async () => {
    renderPicker('menu');

    fireEvent.click(screen.getByTestId('mobile-active-warehouse-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-warehouse-picker')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('mobile-warehouse-option-3'));
    });

    expect(setActiveWarehouseMock).toHaveBeenCalledWith(3, 'South Depot');
  });

  it('marks the currently active warehouse with a check', async () => {
    mockState = { activeWarehouseId: 2, activeWarehouseName: 'North Annex' };
    renderPicker('menu');

    fireEvent.click(screen.getByTestId('mobile-active-warehouse-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-warehouse-picker')).toBeInTheDocument();
    });

    const activeOption = screen.getByTestId('mobile-warehouse-option-2');
    expect(activeOption.className).toContain('mobile-warehouse-option-active');
  });
});
