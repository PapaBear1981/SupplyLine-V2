import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesktopOnlyMessage } from './DesktopOnlyMessage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderComponent = (props = {}) => {
  return render(
    <MemoryRouter>
      <DesktopOnlyMessage {...props} />
    </MemoryRouter>
  );
};

describe('DesktopOnlyMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render default title and description', () => {
    renderComponent();

    expect(screen.getByText('Desktop Only')).toBeInTheDocument();
    expect(screen.getByText('This feature is only available on desktop. Please access it from a computer.')).toBeInTheDocument();
  });

  it('should render custom title and description', () => {
    renderComponent({
      title: 'Admin Panel',
      description: 'Admin features require a desktop browser.',
    });

    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    expect(screen.getByText('Admin features require a desktop browser.')).toBeInTheDocument();
  });

  it('should render back to dashboard button', () => {
    renderComponent();

    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });

  it('should navigate to dashboard when button is clicked', () => {
    renderComponent();

    const button = screen.getByText('Back to Dashboard');
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
