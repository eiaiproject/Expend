# Expend: Privacy-First Offline Personal Finance Tracker PWA

Expend is a privacy-first, offline-first personal finance tracker built as a Progressive Web App (PWA). It helps users track expenses, manage multiple wallets, monitor category budgets, review interactive financial insights, track debts, and generate monthly financial reports while keeping financial data on the user's own device.

The application is built with React, TypeScript, Vite, Tailwind CSS, IndexedDB, Dexie.js, Recharts, Workbox, and the Vite PWA Plugin.

[![CI](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml/badge.svg)](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml)

## Current Release

- Version: `1.0.1`
- Release name: Patch release with bug fixes and CI improvements
- SemVer rationale: patch version for bug fixes only (UpdatePrompt state management, CI process group termination, test infrastructure mock, documentation cleanup). No new features or breaking changes.
- Source availability: the source is publicly available in this repository. No formal open-source license is included yet.

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Quality Assurance](#quality-assurance)
- [Project Structure](#project-structure)
- [Privacy and Security](#privacy-and-security)
- [Offline Behavior](#offline-behavior)
- [Data Portability](#data-portability)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [License](#license)

## Overview

Expend is a client-side personal finance management application for users who want a private expense tracker without accounts, remote databases, automatic cloud sync, or server-side financial data storage. It is designed for mobile and desktop use, with an installable PWA experience and a responsive interface.

Primary use cases:

- Track daily expenses and balance adjustments.
- Manage multiple wallets and monitor wallet balances.
- Transfer funds between wallets with paired transaction records.
- Organize spending with categories and monthly budgets.
- Search, filter, and inspect transaction history.
- Review spending trends, charts, category breakdowns, and monthly reports.
- Track payables and receivables with due dates and payment history.
- Export backups and restore local data manually.

## Core Features

### Progressive Web App

- Installable on iOS, Android, and desktop browsers that support PWA installation.
- Offline app shell after the first successful load.
- Service worker support through Workbox and the Vite PWA Plugin.
- Update prompt when a newer service worker version is available.
- Offline fallback page for navigation failures.

### Local-First Personal Finance Data

- Financial data is stored in IndexedDB on the current device.
- Dexie.js provides typed local database access.
- No account is required.
- No remote API is required for core app functionality.
- No automatic cloud sync is included.

### Transaction Management

- Expense, balance adjustment, transfer-in, and transfer-out transaction types.
- Wallet-to-wallet transfers create paired records through a transfer group.
- Deleting one side of a paired transfer also cleans up the matching transaction.
- Repeat previous transactions with pre-filled details.
- Swipe gestures on mobile transaction cards for edit and delete actions.
- Bulk transaction deletion with undo support.

### Wallet Management

- Create and manage multiple wallets.
- Track initial and current wallet balances.
- Update balances from real-world account values.
- Detect stale wallets that have not been updated within the configured period.

### Categories and Budgets

- Create and manage spending categories.
- Select category colors from a curated palette.
- Set monthly budgets per category.
- View remaining budget and budget usage.
- Receive alerts when spending approaches or exceeds a category budget.

### Search and Filtering

- Full-text transaction search across descriptions, notes, categories, and wallets.
- Search term highlighting.
- Filters for transaction type, category, wallet, date range, and amount range.
- Quick filters for common views such as current period and transfers.
- Date sorting and paginated transaction loading.

### Insights and Analytics

- Dashboard summaries for balance, spending, and recent transactions.
- Daily spending comparison between today and yesterday.
- Current-month top spending category.
- Monthly and all-time expense summary toggle.
- Interactive Recharts visualizations:
  - Daily spending trend.
  - Monthly comparison bar chart.
  - Category distribution chart.
  - Drill-down into related transactions.

### Debt Tracking

- Track payables and receivables.
- Store contact names, descriptions, due dates, notes, and optional wallet/category links.
- Supported debt statuses: pending, partial, settled, and overdue.
- Record payment history.
- Optionally record debt creation and payments as transactions.

### Monthly Financial Reports

- Automatic previous-month report generation at the beginning of the month.
- Financial health score.
- Category breakdown and top expense summary.
- Daily trend analysis.
- Insights and recommendations.
- Downloadable PDF reports generated with jsPDF.
- PDF styling adapts to the selected app theme.

### Data Import and Export

- Export CSV for spreadsheet analysis.
- Export JSON for full local backup.
- Import JSON backups with schema validation.
- Include wallets, categories, transactions, settings, debts, and debt payments in backup payloads.
- Sanitize CSV fields to reduce spreadsheet formula injection risk.
- Sensitive PIN security settings are excluded from JSON exports.

### Security Controls

- PIN-based screen lock.
- PIN hashing with PBKDF2 through the Web Crypto API.
- No plain-text PIN storage.
- Auto-lock after inactivity.
- Route and UI access are gated while the app is locked.
- Important: the PIN lock protects the app screen, but it does not encrypt IndexedDB data at rest.

### Localization and Accessibility

- English and Indonesian translations.
- Browser language detection through i18next.
- Light and dark themes.
- Responsive mobile, tablet, and desktop layouts.
- Automated accessibility checks with Playwright and Axe.

## Architecture

Expend is a browser-only application. The production app is served as static assets, and the user's financial data lives in the browser's local IndexedDB database.

```text
Browser
  React app
  Vite PWA service worker
  IndexedDB
    wallets
    categories
    transactions
    settings
    debts
    debt_payments
```

Key architecture properties:

- Client-side rendering with React and React Router.
- Local persistence through Dexie.js and IndexedDB.
- Service worker precaching and runtime caching for PWA behavior.
- No server-side financial data processing.
- Manual JSON backup and restore for data portability.
- Vercel-compatible static deployment configuration.

## Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, React Router |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 4, CSS custom properties |
| Local Database | IndexedDB, Dexie.js, dexie-react-hooks |
| Charts | Recharts |
| Animation | Motion |
| Internationalization | i18next, react-i18next |
| PWA | Vite PWA Plugin, Workbox |
| PDF Generation | jsPDF |
| Tests | Vitest, jsdom, Playwright, Axe |
| CI | GitHub Actions |

## Getting Started

### Requirements

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

The development server uses Vite on port `3000` and binds to `0.0.0.0`.

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
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Build the production app. |
| `npm run preview` | Preview the production build. |
| `npm run clean` | Remove the `dist` directory. |
| `npm run audit` | Run a high-severity dependency audit against the lockfile. |
| `npm run typecheck` | Run TypeScript type checking. |
| `npm run test` | Start Vitest. |
| `npm run test:unit` | Run unit tests once. |
| `npm run test:pwa-static` | Run static PWA and deployment checks. |
| `npm run test:e2e` | Run Playwright end-to-end tests. |
| `npm run test:lighthouse` | Run Lighthouse smoke checks. |
| `npm run qa:automated` | Run the full automated QA gate. |

## Quality Assurance

The full QA command is:

```bash
npm run qa:automated
```

It runs dependency audit, TypeScript type checking, unit tests, production build, static PWA checks, Playwright E2E tests, and Lighthouse smoke checks. CI runs the same gate in `.github/workflows/ci.yml` on pushes and pull requests targeting the `main` branch.

## Project Structure

```text
Expend/
  .github/workflows/       GitHub Actions CI workflow
  public/                  PWA icons and offline fallback page
  scripts/                 Static QA and Lighthouse smoke scripts
  src/
    components/            Shared UI components and app dialogs
    contexts/              Theme and security providers
    db/                    Dexie database schema and migrations
    hooks/                 App and form hooks
    i18n/                  English and Indonesian translations
    services/              Domain services and unit tests
    utils/                 Formatting, dates, transfers, crypto, PWA helpers
    views/                 Main app views and landing page sections
  tests/e2e/               Playwright E2E and accessibility tests
  index.html               App HTML shell and SEO metadata
  vite.config.ts           Vite, PWA, build, and app version configuration
```

## Privacy and Security

Expend is designed for local-first personal finance tracking.

- The app does not require user accounts.
- Financial records are stored locally in IndexedDB.
- Data is not sent to a remote server by default.
- Users control backups through manual JSON export and import.
- The PIN lock uses PBKDF2 hashing through the Web Crypto API.
- PINs are not stored in plain text.
- The PIN lock is a screen lock, not encrypted at-rest storage.

Users who need encrypted backups or cross-device synchronization should treat those as separate workflows until dedicated features are added.

## Offline Behavior

After the first successful online load, the PWA service worker can serve the app shell and static assets from cache. Local financial data remains in IndexedDB on the current device.

Important offline notes:

- The first load requires a network connection.
- Existing local data can be viewed and edited offline after the app has been cached.
- Offline changes stay on the current device.
- There is no automatic cloud sync.
- `public/offline.html` is used when navigation cannot load the app shell.

## Data Portability

JSON backups include the primary local data model:

- Wallets
- Categories
- Transactions
- Non-sensitive settings
- Debts
- Debt payments

CSV exports are intended for spreadsheet analysis. JSON exports are intended for full backup and restore.

## Deployment

The app is static-deployment friendly and includes `vercel.json` for Vercel headers and routing. The PWA manifest and service worker are generated during the Vite production build.

Recommended deployment flow:

```bash
npm install
npm run qa:automated
npm run build
```

## Roadmap

- Optional cloud sync with explicit user consent.
- Encrypted backup and encrypted local storage options.
- Additional monthly report templates.
- Recurring transaction automation.
- Financial goals.
- Multi-currency support.
- More localization options.
- Budget forecasting improvements.

## Repository Keywords

Personal finance tracker, expense tracker, budget tracker, wallet manager, debt tracker, offline-first PWA, privacy-first finance app, local-first finance app, IndexedDB finance manager, React TypeScript PWA.

## License

No formal open-source license is included yet. Until a `LICENSE` file is added, reuse, redistribution, and modification rights are not granted by this repository text alone.
