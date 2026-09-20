import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Config ini ESM (`"type": "module"`), jadi `__dirname` tidak ada. Sebelumnya
// hanya jalan karena Vite menyuntik shim saat membundel config.
const root = path.dirname(fileURLToPath(import.meta.url));

// Sama seperti vite.config.ts: test melihat versi rilis yang sebenarnya,
// bukan fallback, sehingga guard test version.test.ts bisa membandingkan
// __APP_VERSION__ dengan package.json/README/CHANGELOG.
const version = JSON.parse(readFileSync('./package.json', 'utf8')).version;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // Test selalu memakai jalur CDN default: aset hasil vendor hanya relevan di build.
    __OCR_CORE_LOCAL__: 'false',
    __OCR_LANG_LOCAL__: 'false',
  },
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
      // Ratchet, bukan target: angka di bawah ini adalah lantai agar coverage
      // tidak turun diam-diam (baseline saat ditetapkan: 53% statements/lines,
      // 54% branches, 40% functions). Views memang banyak diuji lewat E2E,
      // jadi lantainya sengaja di bawah baseline, bukan di atasnya.
      thresholds: { statements: 50, branches: 50, functions: 38, lines: 50 },
    },
  },
  resolve: {
    alias: {
      '@tests': path.resolve(root, 'tests'),
      '@tests/*': path.resolve(root, 'tests'),
      '@scripts': path.resolve(root, 'scripts'),
      '@scripts/*': path.resolve(root, 'scripts'),
    },
  },
});
