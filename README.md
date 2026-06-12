# Expend - Privacy-First Offline Personal Finance Tracker PWA

Expend is a local-first personal finance tracker and expense tracker Progressive Web App for budgeting, wallet management, debt and receivable tracking, analytics, and monthly financial reports. It is built for people who want private, offline-capable money management without an account, remote finance database, ads, or mandatory cloud sync.

[![CI](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml/badge.svg)](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.5.0-teal)](https://github.com/eiaiproject/Expend)
[![License](https://img.shields.io/badge/license-proprietary-red)](#license)

## Table of Contents

- [Overview](#overview)
- [Feature Highlights](#feature-highlights)
- [Core Workflows](#core-workflows)
- [Privacy and Security Model](#privacy-and-security-model)
- [PWA and Offline Behavior](#pwa-and-offline-behavior)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Quality Assurance](#quality-assurance)
- [Import, Export, and Backup](#import-export-and-backup)
- [Database Migrations](#database-migrations)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Release Versioning](#release-versioning)
- [Roadmap](#roadmap)
- [License](#license)

## Overview

Expend helps users manage day-to-day personal finance directly in the browser. It combines expense tracking, budget tracking, multi-wallet balance management, debt tracking, receivable tracking, chart-based analytics, and PDF-ready monthly reports in one installable PWA.

The app stores financial data locally in IndexedDB on the current browser profile. Core workflows do not require a backend account or remote API. Users can manually export JSON backups, import backups, or export CSV transaction data for spreadsheet analysis.

## Feature Highlights

- Expense and income tracking with date, wallet, category, description, notes, and repeat options.
- Multi-wallet management with transfers, balance adjustments, stale balance detection, and fast current-balance reads.
- Category management with custom colors and monthly budget limits.
- Debt and receivable tracking for payables, money lent, partial payments, settlements, overdue states, and write-offs.
- Analytics dashboard with spending summaries, daily comparison, monthly comparison, trends, and category distribution.
- Monthly financial report with health score, category analysis, insights, and PDF export.
- Local JSON backup and restore with security settings protected from import/export.
- CSV transaction export for spreadsheet workflows.
- Indonesian and English localization.
- Light and dark themes.
- Installable PWA experience for desktop and mobile browsers.

## Core Workflows

### Transactions

Users can create, edit, repeat, delete, bulk-delete, search, and filter transactions. Filters support transaction type, category, wallet, date range, and amount range.

### Wallets

Wallet balances are maintained through ordinary transactions, paired transfer records, balance adjustments, and debt or receivable cashflows. This keeps wallet summaries fast while preserving an auditable transaction history.

### Budgets

Budgets are assigned per category and tracked monthly. The app shows usage progress and highlights categories that approach or exceed their budget.

### Debts and Receivables

Debt records are intentionally separated from normal expense analytics:

| Action | Record Type | Wallet Effect | Remaining Balance Effect |
|--------|-------------|---------------|--------------------------|
| User receives a loan | Payable debt | Increase wallet | Increase remaining debt |
| User pays a debt | Payable debt | Decrease wallet | Decrease remaining debt |
| User lends money | Receivable | Decrease wallet | Increase remaining receivable |
| User receives repayment | Receivable | Increase wallet | Decrease remaining receivable |
| Write off receivable | Receivable | No wallet change | Remaining becomes zero |
| Mark paid without cashflow | Debt or receivable | No wallet change | Remaining becomes zero |

## Privacy and Security Model

Expend is privacy-first and local-first by design:

- No account is required for core usage.
- No remote finance API is required for core functionality.
- Financial data is stored in IndexedDB on the current device and browser profile.
- No automatic cloud synchronization is performed.
- JSON backups are created manually by the user.
- PIN screen lock uses PBKDF2 hashing through the Web Crypto API.
- PIN hashes and lockout records are excluded from JSON exports.
- Import preserves local security settings on the current device.

Important limitation: the PIN lock protects the app screen from casual access. It does not encrypt IndexedDB at rest. For stronger protection, use an encrypted device, a separate operating system account, an encrypted browser profile, or an encrypted backup location.

Encryption-at-rest for the local database remains a separate roadmap item and requires a stronger passphrase and key-management model than a short PIN.

## PWA and Offline Behavior

- First load requires a network connection.
- After the service worker is ready, the app shell can load offline.
- Local finance data remains available through IndexedDB.
- Main app routes fall back to the cached app shell.
- Offline changes persist locally on the current device.
- The app prompts users when a new service worker version is available.
- Accepting an update reloads the app with the new version; dismissing keeps the current version active.
- Reset Local Data clears IndexedDB, selected local app flags, and Cache Storage. After reset, the app may need a network connection to load assets again.

Expend does not provide automatic multi-device sync. Users should export JSON backups manually when they need portability or recovery.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, React Router |
| Build | Vite 6 |
| Styling | Tailwind CSS 4, CSS custom properties |
| Local database | IndexedDB, Dexie.js |
| Charts | Recharts |
| Animation | Motion |
| Localization | i18next, react-i18next |
| PWA | vite-plugin-pwa, Workbox |
| PDF export | jsPDF |
| CSV export | PapaParse |
| Testing | Vitest, Playwright, Axe |
| Quality | TypeScript strict mode, ESLint |
| CI | GitHub Actions |

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm

### Installation

```bash
git clone https://github.com/eiaiproject/Expend.git
cd Expend
npm install
```

### Development

```bash
npm run dev
```

The development server runs on port `3000` by default.

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the production app |
| `npm run preview` | Preview the production build |
| `npm run clean` | Remove the `dist` directory |
| `npm run audit` | Run dependency audit with a high severity threshold |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run test` | Start Vitest in watch mode |
| `npm run test:unit` | Run unit tests once |
| `npm run test:pwa-static` | Run static PWA checks |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:lighthouse` | Run Lighthouse smoke checks |
| `npm run qa:automated` | Run the full automated QA gate |

## Quality Assurance

Run the full automated QA pipeline before release:

```bash
npm run qa:automated
```

The full pipeline runs dependency audit, ESLint, TypeScript checks, unit tests, production build, static PWA checks, Playwright end-to-end tests, and Lighthouse smoke checks.

For a faster local pre-commit check, run:

```bash
npm run audit
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:pwa-static
```

## Import, Export, and Backup

### JSON Backup Includes

- Wallets
- Categories
- Transactions
- Debts
- Debt payments
- Non-sensitive settings

JSON backups do not include PIN hashes, PIN lockout records, or other sensitive local security state.

### Import Behavior

- Import replaces wallets, categories, transactions, debts, debt payments, and allowed non-sensitive settings.
- Only whitelisted settings such as language and theme are imported from external backups.
- Local PIN and security settings on the current device are preserved.
- Wallet `currentBalance` values are recomputed from transaction and debt cashflow history.
- Legacy backups without debt tables remain valid.

### CSV Export

CSV export contains transaction rows for spreadsheet analysis. CSV export is not a full backup format.

## Database Migrations

IndexedDB schema changes and legacy repair paths are documented in [`docs/database-migrations.md`](docs/database-migrations.md). Update that document whenever `src/db/db.ts` adds a Dexie version or a native preflight repair.

## Deployment

Expend is static-hosting compatible and includes a Vercel configuration.

```bash
npm install
npm run qa:automated
npm run build
```

Deploy the generated `dist` directory to Vercel, Netlify, Cloudflare Pages, or another static file server.

### Deployment Requirements

| Requirement | Vercel | Netlify | Cloudflare Pages |
|-------------|--------|---------|------------------|
| SPA fallback to `index.html` | Included in `vercel.json` | Add `_redirects` with `/* /index.html 200` | Add `_redirects` with `/* /index.html 200` |
| Service worker no-cache header | Included | Add `_headers` rule for `/sw.js` | Add `_headers` rule for `/sw.js` |
| Manifest no-cache header | Included | Add `_headers` rule for `/manifest.webmanifest` | Add `_headers` rule for `/manifest.webmanifest` |
| Immutable asset caching | Included | Add `_headers` rule for `/assets/*` | Add `_headers` rule for `/assets/*` |
| Security headers | Included | Add equivalent `_headers` entries | Add equivalent `_headers` entries |
| HTTPS | Automatic | Automatic | Automatic |

Example Netlify `_redirects` file:

```text
/* /index.html 200
```

Example Netlify `_headers` file:

```text
/sw.js
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.webmanifest
  Cache-Control: no-cache, no-store, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache

/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Project Structure

```text
Expend/
  .github/workflows/    CI configuration
  docs/                 Technical documentation
  public/               PWA assets and offline page
  scripts/              QA and audit scripts
  src/
    components/         Shared UI components
    contexts/           Theme and security providers
    db/                 Dexie schema and IndexedDB migrations
    hooks/              React hooks
    i18n/               English and Indonesian translations
    services/           Business logic and data mutation services
    utils/              Formatting, dates, constants, and PWA helpers
    views/              App pages and landing page sections
  tests/e2e/            Playwright end-to-end tests
```

## Release Versioning

Expend follows Semantic Versioning:

- Major version: breaking changes or incompatible data model changes.
- Minor version: backward-compatible features, user-facing improvements, or significant documentation and production-readiness work.
- Patch version: backward-compatible bug fixes only.

Current release: `v1.5.0`.

## Roadmap

- Optional encrypted backup workflow.
- Optional local database encryption with explicit passphrase-based key management.
- Optional cloud sync with explicit user consent.
- Recurring transaction automation.
- Advanced debt reminders.
- Additional monthly report templates.
- Financial goals and savings tracking.
- Multi-currency support.
- Additional language support.

## License

No formal open-source license is included. The source code is publicly visible, but reuse, redistribution, and modification rights are not granted until a `LICENSE` file is added.
