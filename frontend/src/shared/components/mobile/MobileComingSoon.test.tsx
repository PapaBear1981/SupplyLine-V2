import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileComingSoon } from './MobileComingSoon';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('MobileComingSoon', () => {
  it('renders feature name in title', () => {
    render(
      <MemoryRouter>
        <MobileComingSoon feature="Chemical Forecast" />
      </MemoryRouter>
    );
    expect(screen.getByText('Chemical Forecast — Coming to Mobile')).toBeInTheDocument();
  });

  it('renders a custom description when provided', () => {
    render(
      <MemoryRouter>
        <MobileComingSoon feature="Widgets" description="Custom text goes here." />
      </MemoryRouter>
    );
    expect(screen.getByText('Custom text goes here.')).toBeInTheDocument();
  });

  it('falls back to a generic description', () => {
    render(
      <MemoryRouter>
        <MobileComingSoon feature="User Management" />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/mobile version of user management is in progress/i)
    ).toBeInTheDocument();
  });

  it('navigates to dashboard when the action button is pressed', () => {
    mockNavigate.mockClear();
    render(
      <MemoryRouter>
        <MobileComingSoon feature="Anything" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Back to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
