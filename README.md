# Expend

Privacy-first, offline-first personal finance tracker built as a Progressive Web App.

[![CI](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml/badge.svg)](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml)

## Version

- Current: `1.1.1`
- Release type: Patch (bug fixes)
- Changes: Fixed wallet balance update persistence and filtered internal transactions from description suggestions

## Overview

Expend is a browser-based personal finance application designed for users who require a private expense tracker without accounts, remote APIs, or server-side data storage. The application operates entirely client-side with data persisted in IndexedDB.

**Key characteristics:**

- No user account required
- No remote API dependencies for core functionality
- No automatic cloud sync
- Manual backup and restore via JSON export/import
- Installable as PWA on mobile and desktop

## Features

### Transaction Management

- Expense recording with category assignment
- Wallet-to-wallet transfers with paired transaction records
- Balance adjustment transactions for reconciliation
- Repeat previous transactions with pre-filled details
- Bulk transaction deletion with undo support
- Swipe gestures on mobile for quick edit and delete

### Wallet Management

- Multiple wallet support with independent balance tracking
- Incremental balance updates from transaction history
- Manual balance correction from real-world account values
- Stale wallet detection based on update frequency

### Categories and Budgets

- Custom spending categories with color coding
- Monthly budget limits per category
- Real-time budget usage monitoring
- Alerts when approaching or exceeding budget thresholds

### Search and Filtering

- Full-text search across descriptions, notes, categories, and wallets
- Visual search term highlighting
- Filters by transaction type, category, wallet, date range, and amount
- Quick filters for common views
- Paginated transaction loading

### Insights and Analytics

- Dashboard summaries for balance, spending, and recent transactions
- Daily spending comparison (today vs yesterday)
- Monthly and all-time expense summary toggle
- Interactive charts: daily trend, monthly comparison, category distribution
- Drill-down from charts to related transactions

### Monthly Financial Reports

- Automatic previous-month report generation
- Financial health scoring
- Category breakdown and top expense analysis
- Daily trend analysis with insights
- Downloadable PDF reports with theme-adaptive styling

### Data Import and Export

- CSV export for spreadsheet analysis
- JSON export for full local backup
- JSON import with schema validation
- Legacy format backward compatibility
- Sensitive settings excluded from exports

### Security

- PIN-based screen lock with configurable length
- PBKDF2 hashing via Web Crypto API
- No plain-text PIN storage
- Auto-lock after inactivity timeout
- Note: PIN protects app screen, does not encrypt IndexedDB at rest

### Localization

- English and Indonesian language support
- Browser language detection
- Light and dark themes with system preference detection

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
| PWA | Vite PWA Plugin, Workbox |
| PDF | jsPDF |
| Testing | Vitest, Playwright, Axe |
| CI | GitHub Actions |

## Getting Started

### Prerequisites

- Node.js 20+
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

Development server runs on port `3000`.

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
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run clean` | Remove dist directory |
| `npm run audit` | Run dependency audit |
| `npm run typecheck` | Run TypeScript checking |
| `npm run test` | Start Vitest in watch mode |
| `npm run test:unit` | Run unit tests |
| `npm run test:pwa-static` | Run PWA static checks |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:lighthouse` | Run Lighthouse checks |
| `npm run qa:automated` | Run full QA gate |

## Quality Assurance

Run the complete QA pipeline:

```bash
npm run qa:automated
```

This executes: dependency audit, type checking, unit tests, production build, PWA checks, E2E tests, and Lighthouse audit.

CI runs the same pipeline on pushes and pull requests to `main`.

## Project Structure

```
Expend/
  .github/workflows/    CI configuration
  public/               PWA assets and offline page
  scripts/              QA and audit scripts
  src/
    components/         UI components
    contexts/           Theme and security providers
    db/                 Database schema and migrations
    hooks/              Application hooks
    i18n/               Translations
    services/           Business logic
    utils/              Utilities
    views/              Page views and landing sections
  tests/e2e/            End-to-end tests
```

## Architecture

```
Browser
  React Application
  Vite PWA Service Worker
  IndexedDB
    wallets
    categories
    transactions
    settings
```

- Client-side rendering with React and React Router
- Local persistence via Dexie.js and IndexedDB
- Service worker for offline support
- Static deployment compatible (Vercel, Netlify, etc.)

## Privacy and Security

Expend is designed for local-first personal finance tracking.

- No user accounts required
- Data stored locally in IndexedDB
- No data transmitted to remote servers
- Manual backup control via JSON export/import
- PIN lock uses PBKDF2 hashing
- PIN lock is screen protection, not encryption at rest

Users requiring encrypted storage or cross-device sync should implement those as separate workflows.

## Offline Behavior

After initial online load, the PWA serves cached assets. Local data remains in IndexedDB.

- First load requires network connection
- Subsequent loads work offline
- Offline changes persist locally
- No automatic cloud synchronization
- Offline fallback page for navigation failures

## Data Portability

**JSON exports include:**

- Wallets
- Categories
- Transactions
- Non-sensitive settings

**CSV exports** are for spreadsheet analysis.

**JSON exports** are for full backup and restore.

Legacy formats with debt data are accepted during import for backward compatibility.

## Deployment

Static deployment compatible. Includes `vercel.json` for Vercel configuration.

```bash
npm install
npm run qa:automated
npm run build
```

## Roadmap

- Optional cloud sync with user consent
- Encrypted backup and local storage
- Additional report templates
- Recurring transaction automation
- Financial goals and savings tracking
- Multi-currency support
- Additional language support
- Budget forecasting

## License

No formal open-source license included. Reuse, redistribution, and modification rights are not granted until a LICENSE file is added.
