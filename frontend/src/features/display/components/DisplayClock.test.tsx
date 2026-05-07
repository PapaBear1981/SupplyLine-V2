import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DisplayClock } from './DisplayClock';

describe('DisplayClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-05-07 14:23:45 local time
    vi.setSystemTime(new Date(2026, 4, 7, 14, 23, 45));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the current time, AM/PM, and full date', () => {
    render(<DisplayClock />);

    // 14:23 -> 2:23 PM
    expect(screen.getByText(/2:23/)).toBeInTheDocument();
    expect(screen.getByText('PM')).toBeInTheDocument();
    expect(screen.getByText(':45')).toBeInTheDocument();
    expect(screen.getByText('Thursday, May 7, 2026')).toBeInTheDocument();
  });

  it('ticks every second and updates the seconds display', () => {
    render(<DisplayClock />);

    expect(screen.getByText(':45')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(':46')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(screen.getByText('2:24')).toBeInTheDocument();
    expect(screen.getByText(':01')).toBeInTheDocument();
  });

  it('clears its interval on unmount', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<DisplayClock />);

    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
