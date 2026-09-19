import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // vmThreads: environment jsdom dibuat sekali per worker lalu dipakai ulang
    // antar file, sementara isolasi per-file tetap terjaga (fake-indexeddb,
    // localStorage, dan module state tiap test tidak bocor).
    pool: 'vmThreads',
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    // Menghasilkan coverage/lcov.info (dirujuk sonar-project.properties)
    // lewat `npm run test:coverage`, sehingga path Sonar tidak lagi menggantung.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/vite-env.d.ts', 'src/main.tsx', 'src/**/*.d.ts'],
    },
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
