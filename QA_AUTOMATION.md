# QA Automation

## Command

Run the full automated QA gate:

```bash
npm run qa:automated
```

The command runs:

- `npm run audit`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `npm run test:pwa-static`
- `npm run test:e2e`
- `npm run test:lighthouse`

CI runs the same gate in `.github/workflows/ci.yml`.

## Automated Coverage

- Dependency audit for high and critical advisories.
- TypeScript type checking.
- Unit tests for services, utilities, and selected components.
- Production build validation.
- Static PWA/deployment checks for manifest, service worker, metadata, and Vercel headers.
- Desktop and mobile E2E checks for onboarding, transaction creation, stats route, 404 route, PIN lock, JSON backup/restore including debts and debt payments, offline indicator, and service-worker offline fallback.
- Axe accessibility checks for the main app shell, transaction form dialog, and stats view.
- Lighthouse smoke checks for accessibility, best practices, and SEO.

## Manual QA Still Required

- Real browser PWA install prompt behavior on iOS Safari, Android Chrome, and desktop Chrome/Edge.
- Native standalone launch from home screen or desktop app icon.
- Visual inspection of responsive layout, safe areas, keyboard overlays, and OS-specific browser chrome.
- Real service-worker update UX across an already-installed app after deploying a new version.
- Exported CSV/JSON files opened in real spreadsheet and file-management tools.
- User trust checks for privacy/security copy, especially PIN lock versus encryption at rest.
- Cross-device or shared-device local data cleanup behavior with real user habits.

## Last Local Validation

Date: 2026-06-09

- `npm run qa:automated`: passed.
- E2E: 14 passed.
- Unit tests: 89 passed.
- Lighthouse smoke scores: accessibility `0.91`, best practices `1.00`, SEO `0.91`.

Known non-failing warnings:

- Vite reports an empty `vendor-react` chunk.
- Vite reports large production chunks over 500 KB.
- Vitest reports an existing React `act(...)` warning in `SettingsAccordion.test.tsx`, while the test still passes.
