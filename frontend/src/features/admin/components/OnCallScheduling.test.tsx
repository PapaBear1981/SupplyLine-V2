import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { OnCallScheduling } from './OnCallScheduling';
import type {
  OnCallScheduleEntry,
  OnCallScheduleQuery,
} from '../services/oncallScheduleApi';
import type { User } from '@features/users/types';

const scheduleSpy = vi.fn<
  (q?: OnCallScheduleQuery) => {
    data: OnCallScheduleEntry[] | undefined;
    isLoading: boolean;
    isFetching: boolean;
  }
>();
const usersSpy = vi.fn<() => { data: User[]; isLoading: boolean }>();
const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock('../services/oncallScheduleApi', () => ({
  useGetAdminOnCallScheduleQuery: (q?: OnCallScheduleQuery) => scheduleSpy(q),
  useCreateOnCallScheduleMutation: () => [createMutate, { isLoading: false }],
  useUpdateOnCallScheduleMutation: () => [updateMutate, { isLoading: false }],
  useDeleteOnCallScheduleMutation: () => [deleteMutate, { isLoading: false }],
}));

vi.mock('@features/users/services/usersApi', () => ({
  useGetUsersQuery: () => usersSpy(),
}));

const buildEntry = (overrides: Partial<OnCallScheduleEntry> = {}): OnCallScheduleEntry => ({
  id: 1,
  role: 'materials',
  user: {
    id: 5,
    name: 'Pat Materials',
    employee_number: 'EMP005',
    department: 'Stockroom',
    email: null,
    phone: null,
    avatar: null,
  },
  start_date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
  end_date: dayjs().add(8, 'day').format('YYYY-MM-DD'),
  notes: null,
  created_at: null,
  updated_at: null,
  created_by: null,
  ...overrides,
});

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 5,
  name: 'Pat Materials',
  employee_number: 'EMP005',
  department: 'Stockroom',
  email: null,
  phone: null,
  is_admin: false,
  is_active: true,
  ...overrides,
});

describe('OnCallScheduling (admin)', () => {
  beforeEach(() => {
    scheduleSpy.mockReset();
    usersSpy.mockReset();
    createMutate.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({}) });
    updateMutate.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({}) });
    deleteMutate.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({}) });
    usersSpy.mockReturnValue({ data: [buildUser()], isLoading: false });
  });

  it('renders schedule rows with role tags and user info', () => {
    scheduleSpy.mockReturnValue({
      data: [buildEntry()],
      isLoading: false,
      isFetching: false,
    });

    render(<OnCallScheduling />);

    expect(screen.getByText(/On-Call Schedule/i)).toBeInTheDocument();
    expect(screen.getByText('Pat Materials')).toBeInTheDocument();
    // Role tag - antd Tag renders the label as text
    expect(screen.getAllByText(/Materials/i).length).toBeGreaterThan(0);
    // Add button visible
    expect(screen.getByRole('button', { name: /Add Schedule Entry/i })).toBeInTheDocument();
  });

  it('shows empty-state alert when no schedules exist', () => {
    scheduleSpy.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });

    render(<OnCallScheduling />);

    expect(
      screen.getByText(/No schedule entries in this window/i)
    ).toBeInTheDocument();
  });

  it('opens the create modal when Add Schedule Entry is clicked', async () => {
    scheduleSpy.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });

    render(<OnCallScheduling />);

    fireEvent.click(screen.getByRole('button', { name: /Add Schedule Entry/i }));

    await waitFor(() => {
      // Modal renders dialog with form fields specific to the create dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Date Range/i)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/Optional notes/i)
      ).toBeInTheDocument();
    });
  });

  it('marks an entry that includes today with the "Active now" tag', () => {
    scheduleSpy.mockReturnValue({
      data: [
        buildEntry({
          id: 2,
          start_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
          end_date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
        }),
      ],
      isLoading: false,
      isFetching: false,
    });

    render(<OnCallScheduling />);

    expect(screen.getByText(/Active now/i)).toBeInTheDocument();
  });

  it('passes a date window to the schedule query', () => {
    scheduleSpy.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });

    render(<OnCallScheduling />);

    expect(scheduleSpy).toHaveBeenCalled();
    const args = scheduleSpy.mock.calls[0][0];
    expect(args).toBeDefined();
    expect(args).toHaveProperty('start');
    expect(args).toHaveProperty('end');
  });
});
