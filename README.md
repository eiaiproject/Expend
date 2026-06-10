# Expend

**Privacy-first offline personal finance tracker as a Progressive Web App.**

[![CI](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml/badge.svg)](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml)

---

## Overview

Expend is a local-first personal finance application built for expense tracking, budget planning, multi-wallet management, debt and receivable tracking, analytics, and monthly reports. It runs entirely in the browser with no account required, no server-side storage, and no mandatory cloud synchronization. All data is stored locally on the user's device using IndexedDB.

The application separates ordinary expenses, wallet transfers, balance adjustments, and debt or receivable cashflows so finance summaries remain easy to understand. Debt and receivable records affect wallet balances but are not treated as normal expense or income categories in the main spending analytics.

## Key Features

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
- Incremental `currentBalance` updates for fast reads.

### Categories and Budgets

- Create and manage custom spending categories with colors.
- Assign monthly budgets per category.
- Monitor budget usage in real time.
- Receive warnings when usage approaches or exceeds limits.

### Debt and Receivable Tracking

- Record money borrowed (payable) and money lent (receivable).
- Track partial payments and full settlements.
- Support due dates, overdue states, and written-off receivables.
- Timeline of initial loan cashflows and repayment history.
- Dedicated cashflow records separate from expense analytics.

| Action | Record Type | Wallet Effect | Remaining Balance Effect |
|--------|-------------|---------------|--------------------------|
| User receives a loan | Payable debt | Increase wallet | Increase remaining debt |
| User pays a debt | Payable debt | Decrease wallet | Decrease remaining debt |
| User lends money | Receivable | Decrease wallet | Increase remaining receivable |
| User receives repayment | Receivable | Increase wallet | Decrease remaining receivable |
| Write off receivable | Receivable | No wallet change | Remaining becomes zero |
| Mark paid without cashflow | Debt or receivable | No wallet change | Remaining becomes zero |

### Analytics and Reports

- Dashboard summary for total wallet balance and spending.
- Daily comparison for today and yesterday.
- Interactive charts for monthly comparison, spending trend, and category distribution.
- Drill down from charts into related transactions.
- Monthly financial reports with health score, category analysis, and PDF export.

### Data Portability

- Export transactions to CSV for spreadsheet analysis.
- Export full JSON backups for local restore.
- Import validated JSON backups with automatic balance recomputation.
- Preserve local security settings during import.

### Localization and Theming

- Indonesian and English language support with automatic detection.
- Full bilingual coverage across all features including debt tracking.
- Light and dark themes.
- Installable PWA experience on mobile and desktop browsers.

## Privacy and Security

Expend is privacy-first and local-first by design.

- No account is required.
- No remote finance API is required for core functionality.
- Data is stored in IndexedDB on the current device.
- No automatic cloud sync is performed.
- JSON backups are created manually by the user.
- PIN screen lock uses PBKDF2 hashing through the Web Crypto API.
- Sensitive security settings are excluded from JSON exports.

**Note:** The PIN lock protects the app UI from casual access. It does not encrypt IndexedDB at rest. Use an encrypted device, separate OS account, or encrypted backup location when stronger protection is required.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, React Router |
| Build | Vite 6 |
| Styling | Tailwind CSS 4, CSS custom properties |
| Database | IndexedDB, Dexie.js |
| Charts | Recharts |
| Animation | Motion |
| i18n | i18next, react-i18next |
| PWA | vite-plugin-pwa, Workbox |
| PDF | jsPDF |
| CSV | PapaParse |
| Testing | Vitest, Playwright, Axe |
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

### JSON Exports Include

- Wallets
- Categories
- Transactions
- Debts
- Debt payments
- Non-sensitive settings

JSON exports do not include PIN hashes or lockout records.

### Import Behavior

- Import replaces wallets, categories, transactions, debts, debt payments, and non-sensitive settings.
- Import preserves the local PIN/security setting configured on the current device.
- Imported wallet `currentBalance` values are recomputed from transaction and debt cashflow history.
- Legacy backups without debt tables remain valid.

### CSV Exports

CSV exports include transaction rows for spreadsheet analysis. CSV exports are not full backups.

## PWA and Offline Behavior

- First load requires a network connection.
- After the service worker is ready, the app shell loads offline.
- Local data remains available through IndexedDB.
- App routes (`/`, `/wallets`, `/debts`, `/categories`, `/stats`, `/settings`) fall back to the cached app shell.
- Offline changes persist locally on the current device.
- No automatic sync between devices.

## Deployment

Expend is static-hosting compatible and includes a Vercel configuration.

```bash
npm install
npm run qa:automated
npm run build
```

Deploy the generated `dist` directory to Vercel, Netlify, Cloudflare Pages, or any static file server.

## Project Structure

```text
Expend/
  .github/workflows/    CI configuration
  public/               PWA assets and offline page
  scripts/              QA and audit scripts
  src/
    components/         UI components
    contexts/           Theme and security providers
    db/                 Dexie schema and migrations
    hooks/              React hooks
    i18n/               English and Indonesian translations
    services/           Business logic and data mutations
    utils/              Formatting, dates, PWA helpers
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
