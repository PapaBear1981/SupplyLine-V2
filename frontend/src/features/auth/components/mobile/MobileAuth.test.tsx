import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
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
