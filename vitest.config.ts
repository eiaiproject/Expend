import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@tests': path.resolve(__dirname, 'tests'),
      '@tests/*': path.resolve(__dirname, 'tests'),
      '@scripts': path.resolve(__dirname, 'scripts'),
      '@scripts/*': path.resolve(__dirname, 'scripts'),
    },
  },
});
