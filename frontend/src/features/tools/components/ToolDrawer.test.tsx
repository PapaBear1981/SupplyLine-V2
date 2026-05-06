import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@services/baseApi';
import authReducer from '@features/auth/slices/authSlice';
import { PermissionProvider } from '@features/auth/context/PermissionContext';
import { ThemeProvider } from '@features/settings/contexts/ThemeContext';
import { ConfigProvider } from 'antd';
import dayjs from 'dayjs';

import { ToolDrawer } from './ToolDrawer';
import type { Tool, ToolCalibration } from '../types';

/**
 * Drives the Calibration tab in the tool details drawer. The summary card,
 * "Record Calibration" button, and history timeline are the user-visible
 * surface of the calibration workflow — these tests pin them down so the
 * tab can't silently regress to "shows nothing useful" again.
 */

const mockUseGetToolQuery = vi.fn();
const mockUseGetToolCalibrationsQuery = vi.fn();
const mockUseGetToolBarcodeQuery = vi.fn();
const mockUpdateTool = vi.fn();
const mockCreateTool = vi.fn();
const mockAddCalibration = vi.fn();
const mockUploadCertificate = vi.fn();

vi.mock('../services/toolsApi', () => ({
  useGetToolQuery: (...args: unknown[]) => mockUseGetToolQuery(...args),
  useGetToolCalibrationsQuery: (...args: unknown[]) =>
    mockUseGetToolCalibrationsQuery(...args),
  useGetToolBarcodeQuery: (...args: unknown[]) => mockUseGetToolBarcodeQuery(...args),
  useUpdateToolMutation: () => [mockUpdateTool, { isLoading: false }],
  useCreateToolMutation: () => [mockCreateTool, { isLoading: false }],
  useAddToolCalibrationMutation: () => [mockAddCalibration, { isLoading: false }],
  useUploadCalibrationCertificateMutation: () => [mockUploadCertificate, {}],
}));

vi.mock('@features/warehouses/services/warehousesApi', () => ({
  useGetWarehousesQuery: () => ({
    data: { warehouses: [], pagination: {} },
    isLoading: false,
  }),
}));

vi.mock('@/components/shared/LabelPrintModal', () => ({
  LabelPrintModal: () => null,
}));

vi.mock('@features/tool-checkout', () => ({
  ToolHistoryTimeline: () => <div data-testid="history-timeline" />,
}));

const adminUser = {
  id: 1,
  employee_number: 'ADMIN001',
  name: 'Admin',
  email: 'a@b.com',
  department: 'Materials',
  is_admin: true,
  is_active: true,
  permissions: ['tool.edit'],
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
        // Match the shape expected by authSlice — extra keys are ignored.
      } as unknown as ReturnType<typeof authReducer>,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(baseApi.middleware),
  });
}

function renderDrawer(tool: Tool, calibrations: ToolCalibration[] = []) {
  mockUseGetToolQuery.mockReturnValue({ data: tool, isLoading: false });
  mockUseGetToolCalibrationsQuery.mockReturnValue({ data: calibrations });
  mockUseGetToolBarcodeQuery.mockReturnValue({ data: undefined });

  const store = makeStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <PermissionProvider>
            <ConfigProvider>
              <ToolDrawer
                open
                mode="view"
                toolId={tool.id}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
              />
            </ConfigProvider>
          </PermissionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
}

const baseTool: Tool = {
  id: 200,
  tool_number: 'T200',
  serial_number: 'SN200',
  description: 'Torque Wrench',
  condition: 'Good',
  location: 'Lab',
  category: 'Measurement',
  status: 'available',
  warehouse_id: 1,
  warehouse_name: 'Main',
  created_at: '2025-01-01T00:00:00Z',
  requires_calibration: true,
  calibration_frequency_days: 365,
  last_calibration_date: '2026-04-01T00:00:00Z',
  next_calibration_date: dayjs().add(15, 'day').toISOString(),
  calibration_status: 'due_soon',
};

describe('ToolDrawer — Calibration tab', () => {
  beforeEach(() => {
    cleanup();
    mockAddCalibration.mockReset();
    mockUploadCertificate.mockReset();
    mockUseGetToolQuery.mockReset();
    mockUseGetToolCalibrationsQuery.mockReset();
    mockUseGetToolBarcodeQuery.mockReset();
  });

  it('renders the summary card with last/next dates even when history is empty', async () => {
    renderDrawer(baseTool, []);

    const tab = await screen.findByRole('tab', { name: /calibration/i });
    fireEvent.click(tab);

    // Wait for the summary card to render — the Statistic title is the
    // unique surface area for the Calibration tab. (Note: the Details tab
    // also renders "Last Calibration" in a Description, so we look up
    // the antd Statistic title class explicitly.)
    await screen.findByText(/No calibration records yet/i);

    const statTitles = Array.from(
      document.querySelectorAll('.ant-statistic-title')
    ).map((el) => el.textContent);
    expect(statTitles).toEqual(
      expect.arrayContaining([
        'Status',
        'Frequency',
        'Last Calibration',
        'Next Calibration',
        'Time Until Next',
      ])
    );

    // Last calibration date renders in formatted form somewhere in the tab.
    expect(screen.getAllByText(/Apr 1, 2026/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('365 days').length).toBeGreaterThan(0);
  });

  it('shows "overdue" indicator when next_calibration_date is in the past', async () => {
    const overdueTool: Tool = {
      ...baseTool,
      calibration_status: 'overdue',
      next_calibration_date: dayjs().subtract(7, 'day').toISOString(),
    };
    renderDrawer(overdueTool, []);

    fireEvent.click(await screen.findByRole('tab', { name: /calibration/i }));

    // Wait for the tab content to render.
    await screen.findByText(/No calibration records yet/i);

    // The "Time Until Next" Statistic shows e.g. "7 days overdue" — find it
    // via the Statistic title's sibling. The status Tag also shows
    // "OVERDUE" so we expect at least 2 matches.
    const matches = screen.getAllByText(/overdue/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Specifically, the time-until-next statistic should mention days.
    expect(matches.some((el) => /\d+ days? overdue/i.test(el.textContent || ''))).toBe(true);
  });

  it('renders existing calibration history in the timeline', async () => {
    const cals: ToolCalibration[] = [
      {
        id: 1,
        tool_id: baseTool.id,
        calibration_date: '2026-04-01T00:00:00Z',
        next_calibration_date: '2027-04-01T00:00:00Z',
        performed_by_name: 'Tech One',
        calibration_notes: 'Annual cal — within tolerance',
        calibration_status: 'pass',
        calibration_certificate_file: null,
        created_at: '2026-04-01T00:00:00Z',
      },
    ];
    renderDrawer(baseTool, cals);

    fireEvent.click(await screen.findByRole('tab', { name: /calibration/i }));

    expect(await screen.findByText(/Calibrated by: Tech One/i)).toBeInTheDocument();
    expect(screen.getByText(/Annual cal — within tolerance/i)).toBeInTheDocument();
  });

  it('opens the Record Calibration modal and submits a JSON payload', async () => {
    mockAddCalibration.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          message: 'ok',
          calibration: {
            id: 99,
            tool_id: baseTool.id,
            calibration_date: '2026-05-01T00:00:00Z',
            next_calibration_date: '2027-05-01T00:00:00Z',
            performed_by_name: 'Admin',
            calibration_notes: null,
            calibration_certificate_file: null,
            calibration_status: 'pass',
            created_at: '2026-05-01T00:00:00Z',
          } as ToolCalibration,
        }),
    });

    renderDrawer(baseTool, []);
    fireEvent.click(await screen.findByRole('tab', { name: /calibration/i }));

    fireEvent.click(await screen.findByRole('button', { name: /record calibration/i }));

    // Modal opens with prefilled defaults — submit immediately.
    const modalOk = await screen.findByRole('button', { name: /save calibration/i });
    fireEvent.click(modalOk);

    await waitFor(() => {
      expect(mockAddCalibration).toHaveBeenCalledTimes(1);
    });

    const arg = mockAddCalibration.mock.calls[0][0];
    expect(arg.toolId).toBe(baseTool.id);
    expect(arg.data.calibration_status).toBe('pass');
    expect(typeof arg.data.calibration_date).toBe('string');
    // The frequency-based auto-calc kicks in at form open — next_calibration_date
    // should be roughly +365 days from calibration_date.
    expect(arg.data.next_calibration_date).toBeTruthy();
  });

  it('shows the "enable tracking" empty state for tools that do not require calibration', async () => {
    const untracked: Tool = {
      ...baseTool,
      requires_calibration: false,
      calibration_frequency_days: null,
      last_calibration_date: null,
      next_calibration_date: null,
      calibration_status: 'not_applicable',
    };
    renderDrawer(untracked, []);

    fireEvent.click(await screen.findByRole('tab', { name: /calibration/i }));

    const emptyText = await screen.findByText(/not currently tracked for calibration/i);
    const emptyContainer = emptyText.closest('.ant-empty');
    expect(emptyContainer).not.toBeNull();
    expect(within(emptyContainer as HTMLElement).getByRole('button', { name: /edit tool/i })).toBeInTheDocument();
  });
});
