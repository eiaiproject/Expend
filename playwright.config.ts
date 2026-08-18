import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.E2E_PORT ?? 4387);
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

/**
 * Playwright config for Expend E2E tests.
 *
 * - Runs against a production build served by `vite preview` on a
 *   project-specific port (default 4387).
 * - The build is invoked as part of `webServer.command` so CI does not need
 *   a separate `npm run build` step.
 * - Existing local servers are not reused by default; set E2E_REUSE_SERVER=1
 *   only when you intentionally manage the server yourself.
 * - Storage state is isolated per-test via `tests/e2e/helpers.ts` rather than
 *   a persistent storageState file: IndexedDB cannot be cleared from disk.
 *
 * ponytail: pinned to chromium in CI by default; multi-browser projects kept
 * for local debugging. Add `npm run test:e2e:chromium` to scope runs.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  outputDir: 'test-results',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: e2eBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      // Friction audit B3: WebKit engines intermittently time out waiting for
      // the transaction form to detach after Save (local-only flakes; CI runs
      // chromium). One retry absorbs the flake without masking real failures.
      retries: 1,
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
      retries: 1, // see webkit — same intermittent form-detach flake
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
