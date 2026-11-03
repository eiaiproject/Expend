# Expend

![version](https://img.shields.io/badge/version-0.20.0-teal)

**Expend is an offline-first expense tracker that runs entirely in your browser.** Type an expense the way you would say it (`kopi 25rb dari BSI`), or upload a receipt photo, and Expend turns it into a structured transaction. There is no account, no server, and no analytics: every transaction stays in IndexedDB on your device.

![Expend social card](public/og-image.png)

## Why it exists

Logging a coffee should take five seconds, not a login form plus four dropdowns. Expend is built for people who want to record spending in Bahasa Indonesia or English, on a phone, often without a stable connection. It installs as a PWA, works offline after the first visit, and keeps financial data local by default.

## What you get

| Capability | Detail |
| --- | --- |
| Chat-style entry | Natural language parsing for description, amount, date, source of funds, and note |
| Receipt OCR | Transfer receipts, shop receipts, and QRIS receipts read on-device with Tesseract.js |
| Summary | Search, date filters, grouping by day/week/month, per-group subtotals, inline edit |
| Export and import | JSON backups and RFC 4180 CSV, plus import of Google Sheets CSV exports |
| Privacy | No network calls with transaction data, no tracking, no external OCR CDN |
| Offline | Service worker caches the app and OCR assets after first use |
| Accessibility | Skip link, focus trap, 48 px mobile targets, high contrast mode, font scaling, reduced motion |
| Bilingual | Bahasa Indonesia and English, switchable in Settings |

## Quick start

Requires Node.js 22 or newer.

```bash
npm ci --ignore-scripts
npm run vendor:ocr   # once: copy OCR worker, core, and ind/eng models into public/
npm run dev          # http://localhost:3000
```

`npm run vendor:ocr` is also part of `prebuild`, so production builds always ship the OCR assets from the same origin.

## How to use it

### Record with a sentence

Open **Record** and type:

| Input | Result |
| --- | --- |
| `kopi di Indomaret 50000` | `Kopi di Indomaret`, Rp50.000 |
| `makan siang 30rb kemarin` | `Makan Siang`, Rp30.000, yesterday |
| `kopi 20rb dari kas` | source `Kas` |
| `nasi goreng dari warung Pak Eko 20rb` | seller stays in the description, no source |
| `kopi 25rb note untuk rapat` | note `untuk rapat` |
| `kopi 50` | rejected: plain numbers below Rp100 are treated as noise |

Supported amounts include `50000`, `50.000`, `50,000`, `50rb`, `50k`, `1.5jt`, and `Rp 50.000`. The maximum accepted amount is Rp1.000.000.000.000. Dates use the device's local timezone, so `hari ini` and `kemarin` resolve correctly in WIB.

### Record from a receipt

Upload a JPG, PNG, or WebP image up to 10 MB. OCR runs locally. The parser prefers the labelled final total over components and never treats cash tendered or change as the amount. On QRIS receipts the merchant name becomes the description. Top-up receipts use the saldo as the amount. A `Catatan:` or `Note:` line becomes the transaction note. Damaged numbers such as `1O.000` are rejected instead of guessed.

The first OCR run downloads the worker, core, and both language models from Expend's own origin (about 8 MB). Later runs are served by the service worker cache, so OCR works offline.

### Review and export

**Summary** lists transactions newest first. Filter by date, group by day/week/month, search descriptions, and edit or delete a row. **Settings** holds theme, language, font size, high contrast, backup reminders, JSON/CSV export, import, and the danger zone.

## Data and privacy

- Transactions live in IndexedDB in your browser profile. Expend never uploads them.
- JSON export is the backup format. **Export JSON** writes `expend-YYYY-MM-DD.json` with a versioned schema. CSV export is for spreadsheets.
- Import is append-only, validates every row, and skips exact duplicates.
- Data is **not encrypted**. Anyone with access to the browser profile or device can read it. Clearing site data removes all transactions.
- Backup reminders are local timestamps in `localStorage`, not cloud sync.

## Tech stack

React 19, Vite 8, Tailwind CSS 4, Dexie 4 (IndexedDB), React Router 7, Tesseract.js 7, vite-plugin-pwa, and reicon-react icons.

## Project layout

```
src/views/          HomeView (Summary), ChatView (Record), SettingsView
src/components/     Shared UI: dialogs, toasts, navigation, feedback
src/db/db.ts        Dexie schema and migrations
src/utils/          Parsers, OCR, export/import, dates, grouping, backup
src/i18n/           Indonesian and English dictionaries
public/             Icons, social image, share handler, vendored OCR assets
tests/unit/         Vitest suites, fixtures, contrast and version guards
tests/e2e/          Playwright flows and the pixel-perfect visual audit
scripts/            Version sync, release, Tesseract vendoring, prose guard
docs/               Dexie migration notes and Sheets import format
```

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript over `src`, `tests`, and root configs |
| `npm run lint` | ESLint |
| `npm run lint:prose` | Rejects em dashes in prose and comments |
| `npm run test` | Vitest in watch mode |
| `npm run test:unit` | Vitest single run |
| `npm run test:coverage` | Unit tests with coverage for Sonar |
| `npx playwright test` | E2E and visual audit (starts the dev server) |

`tests/e2e/visual-audit.spec.ts` checks four viewports across three routes for touch targets, padding, overflow, and contrast. It fails on any finding outside its small `INTENTIONAL` list, and entries there need a written reason.

## Versioning and releases

Expend uses semver and Conventional Commits. A merge to `main` cuts a release after CI is green: breaking changes become MAJOR once 1.0 ships (MINOR while on 0.x), `feat` becomes MINOR, and `fix`, `perf`, `refactor`, and `revert` become PATCH.

`package.json` is the only hand-written version. The Settings badge reads `__APP_VERSION__`, the README badge and CHANGELOG are updated by `scripts/sync-version.mjs`, and tags plus release commits are produced by `scripts/auto-release.mjs`. The exported JSON schema (`EXPORT_FORMAT_VERSION`) and the IndexedDB schema (`db.version(N)`) are versioned separately because they must move monotonically, not with feature releases.

## More documentation

- [Design notes](docs/DESIGN.md)
- [Dexie migrations](docs/dexie-migrations.md)
- [Google Sheets CSV import](docs/sheets-import.md)
