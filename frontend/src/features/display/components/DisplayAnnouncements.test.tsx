import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DisplayAnnouncements } from './DisplayAnnouncements';
import type { Announcement } from '@features/admin/types';

const announcementsSpy = vi.fn<() => { data: Announcement[] | undefined }>();

vi.mock('@features/admin/services/adminApi', () => ({
  useGetActiveAnnouncementsQuery: () => announcementsSpy(),
}));

const make = (id: number, over: Partial<Announcement> = {}): Announcement => ({
  id,
  title: `Announcement ${id}`,
  message: `Message ${id}`,
  priority: 'medium',
  is_active: true,
  created_by: 1,
  created_at: '2026-05-01T00:00:00Z',
  ...over,
});

describe('DisplayAnnouncements', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    announcementsSpy.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the empty-state message when there are no announcements', () => {
    announcementsSpy.mockReturnValue({ data: [] });

    render(<DisplayAnnouncements />);

    expect(screen.getByText('No active announcements')).toBeInTheDocument();
  });

  it('renders a single announcement without rotating', () => {
    announcementsSpy.mockReturnValue({
      data: [make(1, { title: 'Solo', message: 'Only one', priority: 'urgent' })],
    });

    render(<DisplayAnnouncements />);

    expect(screen.getByText('Solo')).toBeInTheDocument();
    expect(screen.getByText('Only one')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText('Solo')).toBeInTheDocument();
  });

  it('rotates through multiple announcements every 10 seconds', () => {
    announcementsSpy.mockReturnValue({
      data: [
        make(1, { title: 'First' }),
        make(2, { title: 'Second' }),
        make(3, { title: 'Third' }),
      ],
    });

    render(<DisplayAnnouncements />);

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Third')).toBeInTheDocument();

    // Wraps back to the first announcement.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('applies a priority-specific class to the panel', () => {
    announcementsSpy.mockReturnValue({
      data: [make(1, { priority: 'urgent' })],
    });

    const { container } = render(<DisplayAnnouncements />);
    const panel = container.querySelector('section');
    expect(panel?.className).toMatch(/priorityUrgent/);
  });
});
