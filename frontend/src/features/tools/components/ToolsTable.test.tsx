import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ConfigProvider } from 'antd';

import { baseApi } from '@services/baseApi';
import authReducer from '@features/auth/slices/authSlice';
import { PermissionProvider } from '@features/auth/context/PermissionContext';
import { ThemeProvider } from '@features/settings/contexts/ThemeContext';

import { ToolsTable } from './ToolsTable';
import type { Tool } from '../types';

const mockUseGetToolsQuery = vi.fn();
const mockDeleteTool = vi.fn();
const mockReturnFromField = vi.fn();

vi.mock('../services/toolsApi', () => ({
  useGetToolsQuery: (...args: unknown[]) => mockUseGetToolsQuery(...args),
  useDeleteToolMutation: () => [mockDeleteTool, { isLoading: false }],
  useReturnToolFromFieldMutation: () => [mockReturnFromField, { isLoading: false }],
  useSendToolToFieldMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('./SendToFieldModal', () => ({
  SendToFieldModal: () => null,
}));

vi.mock('@features/kits/services/kitsApi', () => ({
  useGetKitsQuery: () => ({ data: [], isFetching: false }),
}));

vi.mock('@features/warehouses/hooks/useActiveWarehouse', () => ({
  useActiveWarehouse: () => ({
    activeWarehouseId: null,
    activeWarehouseName: null,
  }),
}));

vi.mock('@/components/shared/LabelPrintModal', () => ({
  LabelPrintModal: () => null,
}));

const adminUser = {
  id: 1,
  employee_number: 'ADMIN001',
  name: 'Admin',
  email: 'a@b.com',
  department: 'Materials',
  is_admin: true,
  is_active: true,
  permissions: ['tool.edit', 'tool.delete'],
};

function makeStore() {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        user: adminUser,
        token: 'mock',
        isAuthenticated: true,
        isLoading: false,
      } as unknown as ReturnType<typeof authReducer>,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(baseApi.middleware),
  });
}

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: 1,
    tool_number: 'T001',
    serial_number: 'SN001',
    description: 'Wrench',
    condition: 'good',
    location: 'Bay A',
    category: 'General',
    status: 'available',
    warehouse_id: 1,
    warehouse_name: 'Main',
    created_at: '2025-01-01T00:00:00Z',
    requires_calibration: false,
    calibration_status: 'not_applicable',
    ...overrides,
  };
}

function renderTable() {
  const store = makeStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <PermissionProvider>
            <ConfigProvider>
              <ToolsTable onView={vi.fn()} onEdit={vi.fn()} />
            </ConfigProvider>
          </PermissionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
}

describe('ToolsTable — sorting', () => {
  beforeEach(() => {
    cleanup();
    mockUseGetToolsQuery.mockReset();
    mockDeleteTool.mockReset();
    mockUseGetToolsQuery.mockReturnValue({
      data: { tools: [makeTool()], total: 1, page: 1, per_page: 50, pages: 1 },
      isLoading: false,
      isFetching: false,
    });
  });

  it('initially fetches tools without a sort_by/order parameter', () => {
    renderTable();

    expect(mockUseGetToolsQuery).toHaveBeenCalled();
    const lastCall = mockUseGetToolsQuery.mock.calls.at(-1)?.[0];
    expect(lastCall.sort_by).toBeUndefined();
    expect(lastCall.order).toBeUndefined();
  });

  // Antd renders the column title text twice per sortable header (once visible,
  // once for the sort indicator's tooltip), so we locate the actual <th> by
  // its `.ant-table-column-title` span and walk up to the cell to click.
  const findSortableHeader = (label: string): HTMLElement => {
    const titles = Array.from(
      document.querySelectorAll<HTMLElement>('.ant-table-column-title')
    );
    const match = titles.find((el) => el.textContent?.trim() === label);
    if (!match) throw new Error(`Sortable header not found: ${label}`);
    const th = match.closest<HTMLElement>('th.ant-table-column-has-sorters');
    if (!th) throw new Error(`<th> not sortable for: ${label}`);
    return th;
  };

  it('renders sortable headers for every sortable column', () => {
    renderTable();

    const expected = [
      'Tool Number',
      'Description',
      'Serial Number',
      'Category',
      'Location',
      'Status',
      'Calibration',
    ];
    for (const label of expected) {
      expect(() => findSortableHeader(label)).not.toThrow();
    }
  });

  it('passes sort_by and order to the API when a sortable header is clicked', async () => {
    renderTable();

    fireEvent.click(findSortableHeader('Serial Number'));

    await waitFor(() => {
      const lastCall = mockUseGetToolsQuery.mock.calls.at(-1)?.[0];
      expect(lastCall.sort_by).toBe('serial_number');
      expect(lastCall.order).toBe('asc');
    });
  });

  it('cycles through asc → desc → cleared when the same header is clicked repeatedly', async () => {
    renderTable();

    fireEvent.click(findSortableHeader('Location'));
    await waitFor(() => {
      const c = mockUseGetToolsQuery.mock.calls.at(-1)?.[0];
      expect(c.sort_by).toBe('location');
      expect(c.order).toBe('asc');
    });

    fireEvent.click(findSortableHeader('Location'));
    await waitFor(() => {
      const c = mockUseGetToolsQuery.mock.calls.at(-1)?.[0];
      expect(c.sort_by).toBe('location');
      expect(c.order).toBe('desc');
    });

    fireEvent.click(findSortableHeader('Location'));
    await waitFor(() => {
      const c = mockUseGetToolsQuery.mock.calls.at(-1)?.[0];
      expect(c.sort_by).toBeUndefined();
      expect(c.order).toBeUndefined();
    });
  });

  it('resets to page 1 when the sort changes', async () => {
    mockUseGetToolsQuery.mockReturnValue({
      data: { tools: [makeTool()], total: 200, page: 1, per_page: 50, pages: 4 },
      isLoading: false,
      isFetching: false,
    });
    renderTable();

    fireEvent.click(findSortableHeader('Status'));

    await waitFor(() => {
      const c = mockUseGetToolsQuery.mock.calls.at(-1)?.[0];
      expect(c.sort_by).toBe('status');
      expect(c.page).toBe(1);
    });
  });
});
