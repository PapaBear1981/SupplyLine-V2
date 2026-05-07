import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ConfigProvider } from 'antd';
import { baseApi } from '@services/baseApi';
import authReducer from '@features/auth/slices/authSlice';
import { ThemeProvider } from '@features/settings/contexts/ThemeContext';
import { PermissionProvider } from '@features/auth/context/PermissionContext';

import { RequestDetailModal } from './RequestDetailModal';
import type { UserRequest, UserRequestMessage } from '../types';

/**
 * The dashboard's request detail modal must surface buyer messages so a
 * requester can read and respond without leaving the open-requests view.
 * These tests pin down that the MessageThread is wired to the request-
 * messaging hooks (load, send, mark-read) and that an unread badge alerts
 * the user when there are messages waiting.
 */

const mockUseGetRequestQuery = vi.fn();
const mockUseUpdateRequest = vi.fn();
const mockUseCancelRequest = vi.fn();
const mockUseGetRequestMessagesQuery = vi.fn();
const mockCreateMessage = vi.fn();
const mockMarkMessageRead = vi.fn();
const mockUseGetOrdersByRequestQuery = vi.fn();

vi.mock('../services/requestsApi', () => ({
  useGetRequestQuery: (...args: unknown[]) => mockUseGetRequestQuery(...args),
  useUpdateRequestMutation: () => [mockUseUpdateRequest, { isLoading: false }],
  useCancelRequestMutation: () => [mockUseCancelRequest, { isLoading: false }],
  useGetRequestMessagesQuery: (...args: unknown[]) =>
    mockUseGetRequestMessagesQuery(...args),
  useCreateRequestMessageMutation: () => [mockCreateMessage, { isLoading: false }],
  useMarkRequestMessageAsReadMutation: () => [mockMarkMessageRead, { isLoading: false }],
}));

vi.mock('../services/ordersApi', () => ({
  useGetOrdersByRequestQuery: (...args: unknown[]) => mockUseGetOrdersByRequestQuery(...args),
}));

const baseRequest: UserRequest = {
  id: 42,
  request_number: 'REQ-00042',
  title: 'Need replacement bolts',
  priority: 'routine',
  status: 'pending_fulfillment',
  requester_id: 1,
  buyer_id: 2,
  needs_more_info: false,
  created_at: '2026-05-01T12:00:00Z',
  updated_at: '2026-05-01T12:00:00Z',
  requester_name: 'Regular User',
  buyer_name: 'Buyer User',
  items: [],
};

const buyerMessage: UserRequestMessage = {
  id: 100,
  request_id: 42,
  sender_id: 2,
  recipient_id: 1,
  subject: 'Sourcing update',
  message: 'Vendor confirmed shipment for next week.',
  is_read: false,
  sent_date: '2026-05-02T09:00:00Z',
  sender: { id: 2, first_name: 'Buyer', last_name: 'User', email: 'buyer@example.com' },
  recipient: { id: 1, first_name: 'Regular', last_name: 'User', email: 'reg@example.com' },
};

function makeStore() {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        user: {
          id: 1,
          employee_number: 'USR001',
          name: 'Regular User',
          email: 'reg@example.com',
          department: 'Engineering',
          is_admin: false,
          is_active: true,
          permissions: ['page.requests'],
        },
        token: 'mock',
        isAuthenticated: true,
        isLoading: false,
      } as unknown as ReturnType<typeof authReducer>,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(baseApi.middleware),
  });
}

function renderModal({
  request = baseRequest,
  messages = [] as UserRequestMessage[],
} = {}) {
  mockUseGetRequestQuery.mockReturnValue({ data: request, isLoading: false, error: undefined });
  mockUseGetRequestMessagesQuery.mockReturnValue({ data: messages, isLoading: false });
  mockUseGetOrdersByRequestQuery.mockReturnValue({ data: [], isLoading: false });

  const store = makeStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <PermissionProvider>
            <ConfigProvider>
              <RequestDetailModal open requestId={request.id} onClose={vi.fn()} />
            </ConfigProvider>
          </PermissionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
}

describe('RequestDetailModal — messaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockCreateMessage.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    mockMarkMessageRead.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  it('loads messages for the open request', () => {
    renderModal({ messages: [buyerMessage] });

    // The hook must be invoked with the requestId, and skipped only when closed/empty.
    expect(mockUseGetRequestMessagesQuery).toHaveBeenCalled();
    const [calledWithId, options] = mockUseGetRequestMessagesQuery.mock.calls[0];
    expect(calledWithId).toBe(42);
    // The modal is open, so the query must not be skipped.
    expect((options as { skip?: boolean })?.skip).toBe(false);
  });

  it('renders the buyer message body and subject so the requester can read it', () => {
    renderModal({ messages: [buyerMessage] });

    expect(screen.getByText('Sourcing update')).toBeInTheDocument();
    expect(
      screen.getByText('Vendor confirmed shipment for next week.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Buyer\s+User/)).toBeInTheDocument();
  });

  it('shows an unread indicator in the modal title when there are unread messages', () => {
    renderModal({ messages: [buyerMessage] });

    // antd Modal renders into a portal — scope the query to the modal title,
    // which is the only place we wire an unread badge into the header.
    const title = document.body.querySelector('.ant-modal-title');
    expect(title).not.toBeNull();
    const badge = title!.querySelector('.ant-badge-count');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('1');

    // The message itself also displays an "Unread" badge in the body.
    expect(screen.getByText('Unread')).toBeInTheDocument();
  });

  it('omits the unread indicator from the title when there are no unread messages', () => {
    renderModal({
      messages: [{ ...buyerMessage, is_read: true }],
    });

    const title = document.body.querySelector('.ant-modal-title');
    expect(title).not.toBeNull();
    expect(title!.querySelector('.ant-badge-count')).toBeNull();
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });

  it('marks a buyer message as read when the requester clicks "Mark as Read"', async () => {
    renderModal({ messages: [buyerMessage] });

    fireEvent.click(screen.getByRole('button', { name: /mark as read/i }));

    await waitFor(() => {
      expect(mockMarkMessageRead).toHaveBeenCalledTimes(1);
    });
    expect(mockMarkMessageRead).toHaveBeenCalledWith(buyerMessage.id);
  });

  it('sends a reply through the request-message mutation', async () => {
    renderModal({ messages: [buyerMessage] });

    const subject = screen.getByPlaceholderText('Message subject');
    const body = screen.getByPlaceholderText('Type your message here...');
    fireEvent.change(subject, { target: { value: 'Re: Sourcing update' } });
    fireEvent.change(body, { target: { value: 'Thanks for the update.' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(mockCreateMessage).toHaveBeenCalledTimes(1);
    });

    const [arg] = mockCreateMessage.mock.calls[0];
    expect(arg).toMatchObject({
      requestId: 42,
      message: {
        subject: 'Re: Sourcing update',
        message: 'Thanks for the update.',
      },
    });
  });

  it('renders an empty-state when there are no messages on the request', () => {
    renderModal({ messages: [] });

    // MessageThread shows a placeholder so the section is discoverable
    // even when no buyer message has arrived yet.
    expect(
      screen.getByText(/no messages yet/i)
    ).toBeInTheDocument();
  });
});

describe('RequestDetailModal — message query is skipped when closed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('passes skip=true when modal is closed', () => {
    mockUseGetRequestQuery.mockReturnValue({ data: undefined, isLoading: false, error: undefined });
    mockUseGetRequestMessagesQuery.mockReturnValue({ data: [], isLoading: false });
    mockUseGetOrdersByRequestQuery.mockReturnValue({ data: [], isLoading: false });

    const store = makeStore();
    render(
      <Provider store={store}>
        <BrowserRouter>
          <ThemeProvider>
            <PermissionProvider>
              <ConfigProvider>
                <RequestDetailModal open={false} requestId={42} onClose={vi.fn()} />
              </ConfigProvider>
            </PermissionProvider>
          </ThemeProvider>
        </BrowserRouter>
      </Provider>
    );

    // Among all renders, every invocation of the messages query must have
    // skip=true while the modal is closed.
    expect(mockUseGetRequestMessagesQuery).toHaveBeenCalled();
    for (const call of mockUseGetRequestMessagesQuery.mock.calls) {
      const [, options] = call;
      expect((options as { skip?: boolean })?.skip).toBe(true);
    }
  });
});
