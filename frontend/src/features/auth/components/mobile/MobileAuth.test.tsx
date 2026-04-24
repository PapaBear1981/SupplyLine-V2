import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { MobileLoginForm } from './MobileLoginForm';
import { MobileTotpVerification } from './MobileTotpVerification';
import { MobileBackupCodeForm } from './MobileBackupCodeForm';
import authReducer from '../../slices/authSlice';
import { baseApi } from '@services/baseApi';

const createStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(baseApi.middleware),
  });

const wrap = (node: React.ReactNode) =>
  render(
    <Provider store={createStore()}>
      <BrowserRouter>{node}</BrowserRouter>
    </Provider>
  );

describe('MobileTotpVerification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders title, subtitle and the back / backup-code actions', () => {
    wrap(
      <MobileTotpVerification
        employeeNumber="EMP001"
        onSuccess={vi.fn()}
        onBack={vi.fn()}
        onUseBackupCode={vi.fn()}
      />
    );

    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    expect(
      screen.getByText(/Enter the 6-digit code from your authenticator app/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Use backup code instead/i)).toBeInTheDocument();
    expect(screen.getByText(/Back to login/i)).toBeInTheDocument();
  });

  it('fires onBack when Back to login is pressed', () => {
    const onBack = vi.fn();
    wrap(
      <MobileTotpVerification
        employeeNumber="EMP001"
        onSuccess={vi.fn()}
        onBack={onBack}
        onUseBackupCode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/Back to login/i));
    expect(onBack).toHaveBeenCalled();
  });

  it('fires onUseBackupCode when backup code CTA is pressed', () => {
    const onUseBackupCode = vi.fn();
    wrap(
      <MobileTotpVerification
        employeeNumber="EMP001"
        onSuccess={vi.fn()}
        onBack={vi.fn()}
        onUseBackupCode={onUseBackupCode}
      />
    );

    fireEvent.click(screen.getByText(/Use backup code instead/i));
    expect(onUseBackupCode).toHaveBeenCalled();
  });
});

describe('MobileBackupCodeForm', () => {
  it('renders title and back action', () => {
    wrap(
      <MobileBackupCodeForm
        employeeNumber="EMP001"
        onSuccess={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Use Backup Code')).toBeInTheDocument();
    expect(screen.getByText(/Back to 2FA/i)).toBeInTheDocument();
  });

  it('fires onBack when back action is pressed', () => {
    const onBack = vi.fn();
    wrap(
      <MobileBackupCodeForm
        employeeNumber="EMP001"
        onSuccess={vi.fn()}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByText(/Back to 2FA/i));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('MobileLoginForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the brand lockup, welcome copy and the desktop-matching subtitle', () => {
    wrap(<MobileLoginForm onSuccess={vi.fn()} />);

    expect(screen.getByText('SUPPLYLINE')).toBeInTheDocument();
    expect(screen.getByText('MRO')).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sign in to pick up your tool checkouts, kits, and inventory\./i
      )
    ).toBeInTheDocument();
  });

  it('renders the hero headline with the gradient "right time." accent', () => {
    wrap(<MobileLoginForm onSuccess={vi.fn()} />);

    expect(
      screen.getByText(/Keep the right tool in the right hand/i)
    ).toBeInTheDocument();
    expect(screen.getByText('right time.')).toBeInTheDocument();
  });

  it('shows the first ticker entry on first render', () => {
    wrap(<MobileLoginForm onSuccess={vi.fn()} />);

    expect(screen.getByText('Tool crib')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('cycles ticker entries on an interval when motion is allowed', () => {
    wrap(<MobileLoginForm onSuccess={vi.fn()} />);

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
      wrap(<MobileLoginForm onSuccess={vi.fn()} />);

      expect(screen.getByText('Tool crib')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      expect(screen.getByText('Tool crib')).toBeInTheDocument();
      expect(screen.queryByText('Inventory sync')).not.toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('renders a hero footer line with the current year and SupplyLine', () => {
    wrap(<MobileLoginForm onSuccess={vi.fn()} />);
    const year = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`©\\s*${year}\\s*SupplyLine`))
    ).toBeInTheDocument();
  });
});
