import React from 'react';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@services/baseApi';
import authReducer from '@features/auth/slices/authSlice';
import { ThemeProvider } from '@features/settings/contexts/ThemeContext';
import { PermissionProvider } from '@features/auth/context/PermissionContext';

// Create a test store with optional preloaded state
export function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(baseApi.middleware),
  });
}

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Record<string, unknown>;
  store?: ReturnType<typeof createTestStore>;
}

// Custom render that wraps components with all necessary providers
function customRender(
  ui: ReactElement,
  {
    preloadedState = {},
    store = createTestStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <BrowserRouter>
          <ThemeProvider>
            <PermissionProvider>
              <ConfigProvider>
                {children}
              </ConfigProvider>
            </PermissionProvider>
          </ThemeProvider>
        </BrowserRouter>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

// Re-export everything
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
export { customRender as render };

// Helper to create a mock user
export const createMockUser = (overrides = {}) => ({
  id: 1,
  employee_number: 'EMP001',
  name: 'Test User',
  email: 'test@example.com',
  department: 'Engineering',
  is_admin: false,
  is_active: true,
  permissions: [],
  ...overrides,
});

// Helper to create authenticated state
export const createAuthenticatedState = (user = createMockUser()) => ({
  auth: {
    user,
    token: 'mock-token',
    isAuthenticated: true,
  },
});

// Mobile viewport helper
export const setMobileViewport = () => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 667 });
  window.dispatchEvent(new Event('resize'));
};

// Desktop viewport helper
export const setDesktopViewport = () => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1080 });
  window.dispatchEvent(new Event('resize'));
};
