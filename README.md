# Expend — Local-First Expense and Debt Tracker PWA

Expend is a privacy-focused Progressive Web App for tracking daily expenses, managing multiple wallets, recording debts and receivables, and monitoring budgets. All data stays on your device in IndexedDB. No account, no cloud sync, no ads.

[![CI](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml/badge.svg)](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.7.0-teal)](https://github.com/eiaiproject/Expend)
[![License](https://img.shields.io/badge/license-proprietary-red)](#license)

---

## Table of Contents

- [What Expend Is](#what-expend-is)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Privacy and Security](#privacy-and-security)
- [PWA and Offline Support](#pwa-and-offline-support)
- [Accessibility](#accessibility)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Testing and QA](#testing-and-qa)
- [Data Import and Export](#data-import-and-export)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Versioning](#versioning)
- [Roadmap](#roadmap)
- [License](#license)

---

## What Expend Is

Expend is built for people who want to understand where their money goes without handing personal data to a remote server. It covers three core areas:

1. **Expense Tracking** — Record daily spending with categories, wallets, dates, and notes.
2. **Wallet Management** — Track balances across cash, bank accounts, and e-wallets. Transfer between wallets with automatic double-entry recording.
3. **Debt and Receivable Tracking** — Log money you owe and money others owe you, with partial payments, settlements, overdue detection, and write-offs.

Expend is not a full personal finance suite. It does not track income, salary, investment returns, or net worth. The focus is on outflows and obligations.

---

## Key Features

### Expense Tracking

- Record expenses with category, wallet, date, description, and notes
- Repeat transactions from history
- Bulk delete with selection mode
- Full-text search across descriptions, categories, and wallets

### Wallet Management

- Multi-wallet balance tracking (cash, bank accounts, e-wallets)
- Transfer between wallets with automatic double-entry recording
- Balance adjustments that preserve transaction history
- Stale wallet detection with update prompts
- Spending trend comparison (last 7 days vs previous 7 days)

### Budget Tracking

- Monthly spending limits per category
- Color-coded progress bars (on track, near limit, over budget)
- Real-time budget status in category view

### Debt and Receivable Tracking

- Record payable and receivable debts
- Partial payment recording with remaining balance tracking
- Overdue detection with due date monitoring
- Mark as paid or write off receivables
- Net position summary (receivables minus payables)

### Statistics and Reporting

- Interactive charts: pie, line, and bar with drill-down
- Category spending breakdown with percentage ranking
- Monthly comparison across last 6 months
- Daily spending trend for current period
- Monthly financial report with health score
- PDF export of monthly reports

### Search and Filtering

- Full-text search with type, category, wallet, date, and amount filters
- Draft filter state with apply and reset controls
- Active filter count indicator
- Quick filters for today, this week, and transfers
- Keyboard shortcuts (/ for search, F for filters, S for sort)

### Data Management

- JSON backup and restore (excludes PIN and security state)
- CSV export for spreadsheet analysis
- Import preserves local security settings

### User Experience

- Indonesian and English language support
- Light and dark theme with semantic design tokens
- Swipe gestures on transaction cards (edit, delete)
- Visible kebab menu on transaction cards for discoverable actions
- Segmented period toggle on summary card
- Contextual empty states with direct action buttons
- One-time swipe hint for new users

### Accessibility

- All icon-only buttons have descriptive aria-labels
- No focusable element uses aria-hidden="true"
- Hidden swipe actions are not keyboard-focusable
- FAQ accordion exposes expanded/collapsed state via ARIA
- Bottom sheets use aria-labelledby for programmatic names
- Focus trap inside open modals and sheets
- Focus returns to trigger element after close
- Screen reader summaries for all charts
- Keyboard navigation throughout the application
- Respects prefers-reduced-motion for animations

### PWA and Offline

- Installable on desktop and mobile
- Offline support after first load
- Service worker caching for app shell and assets
- Update prompt for new versions

---

## How It Works

### Transactions

Create, edit, repeat, delete, bulk-delete, search, and filter transactions. Swipe left on a transaction card to reveal Edit and Delete actions, or use the kebab menu for accessible action discovery. Use keyboard shortcuts to navigate quickly.

### Wallets

Each wallet tracks its own balance. Transfers between wallets create paired records. Balance adjustments record the difference without deleting history. Stale wallets that haven't been updated recently show a warning prompt.

### Budgets

Set a monthly spending limit per category. Expend highlights categories approaching or exceeding their limit with color-coded progress bars and text status.

### Debts and Receivables

| User Action | Record Type | Wallet Effect | Remaining Balance |
|---|---|---|---|
| Receive a loan | Payable debt | Wallet increases | Debt increases |
| Pay back a debt | Payable debt | Wallet decreases | Debt decreases |
| Lend money to someone | Receivable | Wallet decreases | Receivable increases |
| Receive repayment | Receivable | Wallet increases | Receivable decreases |
| Write off a receivable | Receivable | No change | Receivable becomes zero |
| Mark as paid (no cash) | Debt or receivable | No change | Balance becomes zero |

---

## Privacy and Security

Expend is local-first by design:

- No account registration required
- No remote API calls for core functionality
- Financial data stored in IndexedDB on your device
- No automatic cloud synchronization
- JSON backups created manually by the user
- PIN screen lock uses PBKDF2 hashing via the Web Crypto API
- PIN hashes and lockout records are excluded from JSON exports
- Import preserves local security settings

**PIN lock limitation:** The PIN protects the app UI from casual access. It does not encrypt the IndexedDB database at rest. For stronger protection, use an encrypted device, a separate OS account, or an encrypted backup location.

---

## PWA and Offline Support

- First load requires a network connection to download the app shell
- After the service worker is ready, the app loads offline
- Local finance data remains available through IndexedDB
- Offline changes persist on the current device
- Update prompt appears when a new service worker version is available
- Reset Local Data clears IndexedDB, app flags, and Cache Storage

Expend does not provide multi-device sync. Export JSON backups manually for portability or disaster recovery.

---

## Accessibility

Expend follows WCAG 2.1 AA guidelines where applicable:

- **Keyboard navigation:** All interactive elements are reachable via Tab, Enter, Escape, and arrow keys
- **Screen readers:** ARIA labels, roles, and live regions provide context for assistive technologies
- **Focus management:** Focus is trapped inside open modals and restored to the trigger on close
- **Color contrast:** Semantic design tokens maintain readable contrast in both light and dark themes
- **Touch targets:** All interactive controls meet the 44x44px minimum touch target size
- **Motion:** Animations respect the prefers-reduced-motion media query
- **Charts:** All chart data is available as screen-reader-only text summaries and interactive lists

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, React Router |
| Build | Vite 6 |
| Styling | Tailwind CSS 4, CSS custom properties |
| Database | IndexedDB via Dexie.js |
| Charts | Recharts |
| Animation | Motion |
| Localization | i18next, react-i18next |
| PWA | vite-plugin-pwa, Workbox |
| PDF Export | jsPDF (dynamically imported) |
| CSV Export | PapaParse |
| Testing | Vitest, Playwright, axe-core |
| Linting | ESLint, TypeScript strict mode |
| CI | GitHub Actions |

---

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm

### Install

```bash
git clone https://github.com/eiaiproject/Expend.git
cd Expend
npm install
```

### Development

```bash
npm run dev
```

The dev server starts on port 3000 by default.

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run clean` | Remove the dist directory |
| `npm run audit` | Run dependency audit (high severity) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Start Vitest in watch mode |
| `npm run test:unit` | Run unit tests once |
| `npm run test:pwa-static` | Run static PWA checks |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:lighthouse` | Run Lighthouse smoke checks |
| `npm run qa:automated` | Run the full QA pipeline |

---

## Testing and QA

Run the full automated QA pipeline before any release:

```bash
npm run qa:automated
```

This runs dependency audit, ESLint, TypeScript checks, unit tests, production build, static PWA checks, Playwright E2E tests, and Lighthouse smoke checks.

For a faster local check:

```bash
npm run audit && npm run lint && npm run typecheck && npm run test:unit && npm run build && npm run test:pwa-static
```

---

## Data Import and Export

### JSON Backup Includes

- Wallets
- Categories
- Transactions
- Debts and debt payments
- Non-sensitive settings (language, theme)

PIN hashes, lockout records, and other security state are excluded from exports.

### Import Behavior

- Replaces wallets, categories, transactions, debts, debt payments, and whitelisted settings
- Preserves local PIN and security settings on the current device
- Recomputes wallet balances from transaction and debt history
- Legacy backups without debt tables remain valid

### CSV Export

CSV export produces transaction rows for spreadsheet analysis. It is not a full backup format.

---

## Deployment

Expend is a static site. Deploy the `dist` directory to any static hosting provider.

```bash
npm install
npm run qa:automated
npm run build
```

Supported platforms: Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any static file server.

### Hosting Requirements

| Requirement | Vercel | Netlify | Cloudflare Pages |
|---|---|---|---|
| SPA fallback to index.html | Included | Add `_redirects` | Add `_redirects` |
| Service worker no-cache header | Included | Add `_headers` rule | Add `_headers` rule |
| Manifest no-cache header | Included | Add `_headers` rule | Add `_headers` rule |
| Immutable asset caching | Included | Add `_headers` rule | Add `_headers` rule |
| HTTPS | Automatic | Automatic | Automatic |

---

## Project Structure

```
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
    services/           Business logic and data services
    utils/              Formatting, dates, constants, PWA helpers
    views/              App pages and landing page sections
  tests/e2e/            Playwright end-to-end tests
```

---

## Versioning

Expend follows Semantic Versioning (semver):

- **Major (X.0.0):** Breaking changes or incompatible data model changes
- **Minor (0.X.0):** Backward-compatible features, UX improvements, accessibility enhancements
- **Patch (0.0.X):** Backward-compatible bug fixes

Current release: **v1.7.0**

---

## Roadmap

- Encrypted backup workflow
- Local database encryption with passphrase-based key management
- Optional cloud sync with explicit user consent
- Recurring expense reminders
- Debt due date calendar view
- Budget setup wizard
- Monthly insight cards
- Quick-add templates for frequent expenses
- Multi-currency support
- Additional language support

---

## License

No formal open-source license is included. Source code is publicly visible, but reuse, redistribution, and modification rights are not granted until a LICENSE file is added to the repository.
