# Expend: Privacy-First Offline Personal Finance Tracker PWA

Expend is a local-first personal finance tracker built as a Progressive Web App for expense tracking, budget planning, multi-wallet management, debt and receivable tracking, analytics, and monthly reports.

[![CI](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml/badge.svg)](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml)

## Project Metadata

| Field | Value |
|-------|-------|
| Application | Expend |
| Current version | `1.2.0` |
| Release type | Minor |
| Release focus | Debt and receivable management, documentation alignment, landing page consistency |
| Runtime model | Client-side, local-first, offline-capable PWA |
| Primary storage | IndexedDB via Dexie.js |
| Primary keywords | personal finance tracker, offline expense tracker, budget tracker PWA, wallet manager, debt tracker, receivable tracker, local-first finance app |

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Debt and Receivable Tracking](#debt-and-receivable-tracking)
- [Privacy and Security](#privacy-and-security)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Quality Assurance](#quality-assurance)
- [Import, Export, and Backup](#import-export-and-backup)
- [PWA and Offline Behavior](#pwa-and-offline-behavior)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [License](#license)

## Overview

Expend is designed for people who want a private finance app without accounts, server-side storage, or mandatory cloud synchronization. It runs in the browser, can be installed as a PWA, and stores finance data locally on the user's device.

The application separates ordinary expenses, wallet transfers, balance adjustments, and debt or receivable cashflow so finance summaries remain easy to understand. Debt and receivable records affect wallet balances but are not treated as normal expense or income categories in the main spending analytics.

## Core Features

### Expense Tracking

- Record expenses with amount, date, category, wallet, description, and notes.
- Edit, repeat, delete, and bulk-delete transactions.
- Swipe transaction cards on mobile for quick edit and delete actions.
- Search transactions by description, notes, category, and wallet.
- Filter by transaction type, category, wallet, date range, and amount range.

### Wallet Management

- Manage multiple wallets with independent balances.
- Move money between wallets using paired transfer records.
- Reconcile real-world balances through balance adjustments.
- Detect stale wallet balances that have not been updated recently.
- Keep `currentBalance` updated incrementally for fast reads.

### Categories and Budgets

- Create and manage custom spending categories.
- Assign category colors and monthly budgets.
- Monitor budget usage in real time.
- Receive budget warnings when usage approaches or exceeds limits.

### Analytics and Reports

- Dashboard summary for total wallet balance and spending.
- Daily comparison for today and yesterday.
- Interactive charts for monthly comparison, spending trend, and category distribution.
- Drill down from charts into related transactions.
- Generate monthly financial reports with health score, category analysis, and PDF export.

### Data Portability

- Export transactions to CSV for spreadsheet analysis.
- Export full JSON backups for local restore.
- Import validated JSON backups.
- Preserve local security settings during import.
- Recompute wallet balances from imported transactions and debt cashflows instead of trusting stale backup balances.

### Localization and Theming

- Indonesian and English language support.
- Browser language detection.
- Light and dark themes.
- Installable PWA experience on mobile and desktop browsers.

## Debt and Receivable Tracking

Version `1.2.0` adds a dedicated debt and receivable feature.

### Supported Records

- `Utang Saya`: money borrowed by the user and owed back to another person.
- `Piutang Saya`: money lent by the user and expected to be received back.
- Partial payments and full settlement.
- Due dates, no-due-date records, overdue state, paid state, and written-off receivables.
- Timeline of initial loan cashflow and repayment history.

### Wallet Balance Rules

| Action | Record Type | Wallet Effect | Remaining Balance Effect |
|--------|-------------|---------------|--------------------------|
| User receives a loan | Payable debt | Increase wallet | Increase remaining debt |
| User pays a debt | Payable debt | Decrease wallet | Decrease remaining debt |
| User lends money | Receivable | Decrease wallet | Increase remaining receivable |
| User receives repayment | Receivable | Increase wallet | Decrease remaining receivable |
| Write off receivable | Receivable | No wallet change | Remaining becomes zero |
| Mark paid without cashflow | Debt or receivable | No wallet change | Remaining becomes zero |

Debt and receivable cashflows are stored in dedicated IndexedDB tables and are intentionally separate from ordinary expense statistics.

## Privacy and Security

Expend is privacy-first and local-first.

- No account is required.
- No remote finance API is required for core functionality.
- Data is stored in IndexedDB on the current device.
- No automatic cloud sync is performed.
- JSON backups are created manually by the user.
- PIN screen lock uses PBKDF2 hashing through the Web Crypto API.
- Sensitive security settings are excluded from JSON exports.

The PIN lock protects the app UI from casual access. It does not encrypt IndexedDB at rest. Anyone with access to the operating system account, browser profile, DevTools, malware, or extracted browser storage may be able to inspect local finance data outside the app UI. Use an encrypted device, separate OS account, or encrypted backup location when stronger protection is required.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, React Router |
| Build tooling | Vite 6 |
| Styling | Tailwind CSS 4, CSS custom properties |
| Local database | IndexedDB, Dexie.js, dexie-react-hooks |
| Charts | Recharts |
| Animation | Motion |
| Internationalization | i18next, react-i18next |
| PWA | vite-plugin-pwa, Workbox |
| PDF generation | jsPDF |
| CSV handling | PapaParse |
| Testing | Vitest, Playwright, Axe |
| CI | GitHub Actions |

## Architecture

```text
Browser
  React Application
  React Router Views
  Vite PWA Service Worker
  IndexedDB via Dexie
    wallets
    categories
    transactions
    debts
    debtPayments
    settings
```

Key architecture choices:

- Client-side rendering with React and React Router.
- Local persistence with Dexie.js and IndexedDB.
- Atomic wallet balance updates through service-layer mutations.
- PWA service worker for installability and offline app shell caching.
- Separation between spending transactions and debt or receivable cashflows.

## Data Model

### Wallets

Wallets store initial balances and incrementally maintained current balances.

### Transactions

Transactions cover:

- `expense`
- `balance_adjustment`
- `transfer_in`
- `transfer_out`

These records power expense analytics, transaction history, charts, and category reporting.

### Debts

Debt records cover:

- `payable`: the user owes someone else.
- `receivable`: someone else owes the user.

Debt status can be open, partial, overdue, paid, or written off. Status is calculated from remaining amount, due date, and payment history.

### Debt Payments

Debt payment records cover:

- `initial`: loan money received or given.
- `repayment`: debt payment or receivable collection.
- `adjustment`: settlement without wallet cashflow.
- `write_off`: receivable closure without wallet cashflow.

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
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Build the production app |
| `npm run preview` | Preview the production build |
| `npm run clean` | Remove the `dist` directory |
| `npm run audit` | Run dependency audit with high severity threshold |
| `npm run typecheck` | Run TypeScript checks |
| `npm run test` | Start Vitest in watch mode |
| `npm run test:unit` | Run unit tests once |
| `npm run test:pwa-static` | Run static PWA checks |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:lighthouse` | Run Lighthouse smoke checks |
| `npm run qa:automated` | Run the full QA gate |

## Quality Assurance

Run the full automated QA pipeline:

```bash
npm run qa:automated
```

The pipeline executes dependency audit, TypeScript checks, unit tests, production build, PWA static checks, Playwright tests, and Lighthouse smoke checks.

Recommended checks before release:

```bash
npm run typecheck
npm run test:unit
npm run build
```

## Import, Export, and Backup

JSON exports include:

- Wallets
- Categories
- Transactions
- Debts
- Debt payments
- Non-sensitive settings

JSON exports do not include PIN hashes or lockout records.

Import behavior:

- Import replaces wallets, categories, transactions, debts, debt payments, and non-sensitive settings.
- Import preserves the local PIN/security setting configured on the current device.
- Imported wallet `currentBalance` values are recomputed from transaction and debt cashflow history.
- Legacy backups without debt tables remain valid.
- Older `debt_payments` backup keys are accepted for backward compatibility.

CSV exports include transaction rows for spreadsheet analysis. CSV exports are not full backups.

## PWA and Offline Behavior

Expend can be installed as a Progressive Web App.

- First load requires a network connection.
- After the service worker is ready, the app shell can load offline.
- Local data remains available through IndexedDB.
- App routes such as `/`, `/wallets`, `/debts`, `/categories`, `/stats`, and `/settings` fall back to the cached app shell.
- Offline changes persist locally on the current device.
- There is no automatic sync between devices.

If the app appears stuck on an older version, export a JSON backup first, then reload while online or clear site data from browser settings.

## Deployment

Expend is static-hosting compatible and includes a Vercel configuration.

```bash
npm install
npm run qa:automated
npm run build
```

Deploy the generated `dist` directory to a static hosting provider such as Vercel, Netlify, Cloudflare Pages, or any static file server.

## Project Structure

```text
Expend/
  .github/workflows/    Continuous integration
  public/               PWA assets and offline page
  scripts/              QA and audit scripts
  src/
    components/         Shared UI components and feature components
    contexts/           Theme and security providers
    db/                 Dexie schema and migrations
    hooks/              React hooks
    i18n/               English and Indonesian translations
    services/           Business logic and data mutations
    utils/              Formatting, dates, PWA helpers, and utilities
    views/              Application pages and landing sections
  tests/e2e/            End-to-end tests
```

## Roadmap

- Optional encrypted backup workflow.
- Optional cloud sync with explicit user consent.
- Recurring transaction automation.
- Advanced debt reminders.
- Additional report templates.
- Financial goals and savings tracking.
- Multi-currency support.
- Additional language support.

## License

No formal open-source license is included. Reuse, redistribution, and modification rights are not granted until a `LICENSE` file is added.
