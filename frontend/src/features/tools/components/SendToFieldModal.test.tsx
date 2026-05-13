import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@services/baseApi';
import authReducer from '@features/auth/slices/authSlice';
import { PermissionProvider } from '@features/auth/context/PermissionContext';
import { ThemeProvider } from '@features/settings/contexts/ThemeContext';
import { ConfigProvider } from 'antd';

import { SendToFieldModal } from './SendToFieldModal';
import type { Tool } from '../types';

const mockUseGetKitsQuery = vi.fn();
const mockSendToField = vi.fn();

vi.mock('@features/kits/services/kitsApi', () => ({
  useGetKitsQuery: (...args: unknown[]) => mockUseGetKitsQuery(...args),
}));

vi.mock('../services/toolsApi', () => ({
  useSendToolToFieldMutation: () => [mockSendToField, { isLoading: false }],
}));

const tool: Tool = {
  id: 42,
  tool_number: 'T-42',
  description: 'A tool',
  serial_number: 'SN-42',
  category: 'General',
  condition: 'good',
  location: 'Hangar',
  status: 'available',
  requires_calibration: false,
  warehouse_id: 1,
} as Tool;

function renderModal() {
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(baseApi.middleware),
  });
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <PermissionProvider>
            <ConfigProvider>
              <SendToFieldModal open={true} tool={tool} onClose={vi.fn()} />
            </ConfigProvider>
          </PermissionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>,
  );
}

describe('SendToFieldModal', () => {
  beforeEach(() => {
    cleanup();
    mockUseGetKitsQuery.mockReset();
    mockSendToField.mockReset();
    mockSendToField.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  it('warns when no field locations are registered', () => {
    mockUseGetKitsQuery.mockReturnValue({ data: [], isFetching: false });
    renderModal();
    expect(
      screen.getByText(/No registered field locations/i),
    ).toBeInTheDocument();
  });

  it('filters out kits without tail/tanker/trailer identifiers', () => {
    mockUseGetKitsQuery.mockReturnValue({
      data: [
        { id: 1, name: 'No-ID Kit' },
        {
          id: 2,
          name: 'With Tail',
          aircraft_tail_number: 'N42HQ',
          tanker_scooper_number: null,
          trailer_number: null,
        },
      ],
      isFetching: false,
    });
    renderModal();
    expect(
      screen.queryByText(/No registered field locations/i),
    ).not.toBeInTheDocument();
  });

  it('submits selected kit_id to the send mutation', async () => {
    mockUseGetKitsQuery.mockReturnValue({
      data: [
        {
          id: 7,
          name: 'Field 7',
          aircraft_tail_number: 'N777',
          tanker_scooper_number: 'T-7',
          trailer_number: 'TR-7',
        },
      ],
      isFetching: false,
    });
    renderModal();

    // Open the select dropdown
    const selectInput = screen.getByTestId('send-to-field-location-select')
      .querySelector('input') as HTMLInputElement;
    fireEvent.mouseDown(selectInput);

    const option = await screen.findByText(/Tail N777 \/ Tanker T-7 \/ Trailer TR-7/);
    fireEvent.click(option);

    const okBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(okBtn);

    await waitFor(() => {
      expect(mockSendToField).toHaveBeenCalledWith(
        expect.objectContaining({ toolId: 42, kitId: 7 }),
      );
    });
  });
});
