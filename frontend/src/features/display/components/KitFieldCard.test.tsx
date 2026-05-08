import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KitFieldCard } from './KitFieldCard';
import type { Kit, KitToolCheckout } from '@features/kits/types';

const baseKit: Kit = {
  id: 1,
  name: 'Alpha Kit',
  aircraft_type_id: 1,
  aircraft_type_name: 'F-35A',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  created_by: 1,
  location_city: 'Phoenix',
  location_state: 'AZ',
};

const checkout = (over: Partial<KitToolCheckout> = {}): KitToolCheckout => ({
  id: over.id ?? 1,
  tool_id: over.tool_id ?? 100,
  tool_number: over.tool_number ?? 'T-100',
  tool_description: over.tool_description ?? 'Torque wrench',
  kit_id: 1,
  checked_out_by_id: 1,
  checkout_date: over.checkout_date ?? '2026-05-01T12:00:00Z',
  expected_return_date: over.expected_return_date ?? null,
  status: 'active',
  ...over,
});

describe('KitFieldCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 7, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders kit name, aircraft type, and city/state location', () => {
    render(<KitFieldCard kit={baseKit} checkouts={[]} />);

    expect(screen.getByRole('heading', { name: 'Alpha Kit' })).toBeInTheDocument();
    expect(screen.getByText('F-35A')).toBeInTheDocument();
    expect(screen.getByText('Phoenix, AZ')).toBeInTheDocument();
  });

  it('falls back to address, then trailer number, then a placeholder', () => {
    const noCity: Kit = { ...baseKit, location_city: null, location_state: null, location_address: '123 Hangar Rd' };
    const { rerender } = render(<KitFieldCard kit={noCity} checkouts={[]} />);
    expect(screen.getByText('123 Hangar Rd')).toBeInTheDocument();

    const trailerOnly: Kit = { ...noCity, location_address: null, trailer_number: 'TR-9' };
    rerender(<KitFieldCard kit={trailerOnly} checkouts={[]} />);
    expect(screen.getByText('Trailer TR-9')).toBeInTheDocument();

    const noLocation: Kit = { ...trailerOnly, trailer_number: null };
    rerender(<KitFieldCard kit={noLocation} checkouts={[]} />);
    expect(screen.getByText('Location not set')).toBeInTheDocument();
  });

  it('shows the empty-state message when no checkouts', () => {
    render(<KitFieldCard kit={baseKit} checkouts={[]} />);

    expect(screen.getByText('No tools currently deployed')).toBeInTheDocument();
  });

  it('renders each checkout with tool number, description, and checkout date', () => {
    const checkouts = [
      checkout({ id: 1, tool_number: 'T-100', tool_description: 'Torque wrench', checkout_date: '2026-05-01T12:00:00Z' }),
      checkout({ id: 2, tool_number: 'T-200', tool_description: 'Multimeter', checkout_date: '2026-05-03T12:00:00Z' }),
    ];

    render(<KitFieldCard kit={baseKit} checkouts={checkouts} />);

    expect(screen.getByText('T-100')).toBeInTheDocument();
    expect(screen.getByText('Torque wrench')).toBeInTheDocument();
    expect(screen.getByText('May 1')).toBeInTheDocument();
    expect(screen.getByText('T-200')).toBeInTheDocument();
    expect(screen.getByText('Multimeter')).toBeInTheDocument();
    expect(screen.getByText('May 3')).toBeInTheDocument();
  });

  it('flags overdue checkouts and shows the overdue chip', () => {
    const checkouts = [
      checkout({ id: 1, expected_return_date: '2026-05-01T12:00:00Z' }), // before "today"
      checkout({ id: 2, expected_return_date: '2026-06-01T12:00:00Z' }), // future
    ];

    const { container } = render(<KitFieldCard kit={baseKit} checkouts={checkouts} />);

    expect(screen.getByText('1 overdue')).toBeInTheDocument();
    // Exactly one row should carry the overdue modifier class.
    const overdueRows = container.querySelectorAll('[class*="checkoutOverdue"]');
    expect(overdueRows.length).toBe(1);
  });

  it('renders only the first 6 checkouts and a "+N more" footer', () => {
    const checkouts = Array.from({ length: 9 }, (_, i) =>
      checkout({ id: i + 1, tool_number: `T-${i + 1}`, tool_description: `Tool ${i + 1}` })
    );

    render(<KitFieldCard kit={baseKit} checkouts={checkouts} />);

    expect(screen.getByText('T-1')).toBeInTheDocument();
    expect(screen.getByText('T-6')).toBeInTheDocument();
    expect(screen.queryByText('T-7')).not.toBeInTheDocument();
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('renders the kit status, normalising underscores', () => {
    render(<KitFieldCard kit={{ ...baseKit, status: 'maintenance' }} checkouts={[]} />);
    expect(screen.getByText('maintenance')).toBeInTheDocument();
  });

  it('shows the assigned user when one is set, and "Unassigned" otherwise', () => {
    const assigned: Kit = { ...baseKit, assigned_user_id: 7, assigned_user_name: 'Jane Doe' };
    const { rerender } = render(<KitFieldCard kit={assigned} checkouts={[]} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();

    rerender(<KitFieldCard kit={baseKit} checkouts={[]} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});
