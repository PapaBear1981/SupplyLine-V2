import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LoginHero } from './LoginHero';

describe('LoginHero', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the brand lockup, headline and supporting copy', () => {
    render(<LoginHero />);

    expect(screen.getByText('SUPPLYLINE')).toBeInTheDocument();
    expect(screen.getByText('MRO')).toBeInTheDocument();
    expect(screen.getByText(/Keep the right tool in the right hand/i)).toBeInTheDocument();
    expect(screen.getByText('right time.')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Inventory, checkouts, and accountability, built for MRO\./i
      )
    ).toBeInTheDocument();
  });

  it('shows the first ticker entry on first render', () => {
    render(<LoginHero />);

    expect(screen.getByText('Tool crib')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('cycles ticker entries on an interval when motion is allowed', () => {
    render(<LoginHero />);

    // Advance past the 3800ms interval; the next ticker entry should render.
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText('Inventory sync')).toBeInTheDocument();
  });

  it('freezes the ticker when prefers-reduced-motion is set', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      render(<LoginHero />);

      expect(screen.getByText('Tool crib')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      // Still on the first entry — no interval was registered.
      expect(screen.getByText('Tool crib')).toBeInTheDocument();
      expect(screen.queryByText('Inventory sync')).not.toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('renders a footer line with the current year', () => {
    render(<LoginHero />);
    const year = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`©\\s*${year}\\s*SupplyLine`))
    ).toBeInTheDocument();
  });
});
