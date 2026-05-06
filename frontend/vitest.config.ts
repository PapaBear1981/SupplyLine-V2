import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    env: {
      // RTK Query's baseQuery reads VITE_API_BASE_URL ?? ''. With an empty
      // string, relative URLs like /api/... can't be parsed as Request URLs
      // in node's undici, breaking mutation/endpoint tests. Provide an
      // absolute origin for tests so request construction succeeds.
      VITE_API_BASE_URL: 'http://localhost',
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@services': path.resolve(__dirname, './src/services'),
      '@app': path.resolve(__dirname, './src/app'),
    },
  },
});
