import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import dayjs from 'dayjs';
import { OnCallSchedulePage } from './OnCallSchedulePage';
import type {
  OnCallScheduleEntry,
  OnCallScheduleQuery,
} from '@features/admin/services/oncallScheduleApi';
import type { OnCallPersonnel } from '@features/admin/services/oncallApi';

const scheduleSpy = vi.fn<
  (q?: OnCallScheduleQuery) => { data: OnCallScheduleEntry[] | undefined; isLoading: boolean }
>();
const personnelSpy = vi.fn<() => { data: OnCallPersonnel | undefined }>();

vi.mock('@features/admin/services/oncallScheduleApi', () => ({
  useGetOnCallScheduleQuery: (q?: OnCallScheduleQuery) => scheduleSpy(q),
}));

vi.mock('@features/admin/services/oncallApi', () => ({
  useGetOnCallPersonnelQuery: () => personnelSpy(),
}));

const baseUser = {
  id: 1,
  name: 'Pat Materials',
  employee_number: 'EMP001',
  department: 'Stockroom',
  email: 'pat@example.com',
  phone: '555-0100',
  avatar: null,
};

const buildEntry = (overrides: Partial<OnCallScheduleEntry> = {}): OnCallScheduleEntry => ({
  id: 1,
  role: 'materials',
  user: baseUser,
  start_date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
  end_date: dayjs().add(8, 'day').format('YYYY-MM-DD'),
  notes: null,
  created_at: null,
  updated_at: null,
  created_by: null,
  ...overrides,
});

describe('OnCallSchedulePage', () => {
  beforeEach(() => {
    scheduleSpy.mockReset();
    personnelSpy.mockReset();
    personnelSpy.mockReturnValue({
      data: {
        materials: { user: null, updated_at: null, updated_by: null },
        maintenance: { user: null, updated_at: null, updated_by: null },
      },
    });
  });

  it('renders upcoming schedule entries with user details and date range', () => {
    const upcoming = buildEntry();
    scheduleSpy.mockReturnValue({ data: [upcoming], isLoading: false });

    render(<OnCallSchedulePage />);

    expect(screen.getByText(/On-Call Schedule/i)).toBeInTheDocument();
    expect(screen.getByText('Pat Materials')).toBeInTheDocument();
    expect(screen.getByText(/#EMP001/)).toBeInTheDocument();
    expect(screen.getByText(/Stockroom/)).toBeInTheDocument();
    expect(screen.getByText(/555-0100/)).toBeInTheDocument();
  });

  it('shows "Active now" tag when the current date falls in the range', () => {
    const active = buildEntry({
      id: 2,
      start_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
      end_date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    });
    scheduleSpy.mockReturnValue({ data: [active], isLoading: false });

    render(<OnCallSchedulePage />);

    // Active entries live under the "Active" tab; switch to it before asserting.
    fireEvent.click(screen.getByRole('tab', { name: /Active \(\d+\)/i }));
    expect(screen.getByText(/Active now/i)).toBeInTheDocument();
  });

  it('shows the empty-state alert when there are no schedules', () => {
    scheduleSpy.mockReturnValue({ data: [], isLoading: false });

    render(<OnCallSchedulePage />);

    expect(
      screen.getByText(/No scheduled on-call coverage in this window/i)
    ).toBeInTheDocument();
  });

  it('shows current on-call personnel cards from the legacy endpoint', () => {
    scheduleSpy.mockReturnValue({ data: [], isLoading: false });
    personnelSpy.mockReturnValue({
      data: {
        materials: {
          user: { ...baseUser, name: 'Jordan Now' },
          updated_at: null,
          updated_by: null,
        },
        maintenance: { user: null, updated_at: null, updated_by: null },
      },
    });

    render(<OnCallSchedulePage />);

    expect(screen.getByText('Jordan Now')).toBeInTheDocument();
    expect(screen.getByText(/Materials — On Call Today/i)).toBeInTheDocument();
    expect(screen.getByText(/Maintenance — On Call Today/i)).toBeInTheDocument();
  });

  it('renders a loading spinner while fetching', () => {
    scheduleSpy.mockReturnValue({ data: undefined, isLoading: true });

    const { container } = render(<OnCallSchedulePage />);

    // antd Spin renders an element with class "ant-spin"
    expect(container.querySelector('.ant-spin')).not.toBeNull();
  });

  it('passes the start, end, and (when filtered) role into the schedule query', () => {
    scheduleSpy.mockReturnValue({ data: [], isLoading: false });

    render(<OnCallSchedulePage />);

    expect(scheduleSpy).toHaveBeenCalled();
    const args = scheduleSpy.mock.calls[0][0];
    expect(args).toBeDefined();
    expect(args).toHaveProperty('start');
    expect(args).toHaveProperty('end');
    // Default filter is 'all', so role should not be sent
    expect(args).not.toHaveProperty('role');
  });
});
