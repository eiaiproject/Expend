# Expend - Privacy-First Offline Expense Tracker PWA

Expend is a local-first personal finance tracker for expenses, budgets, wallets, debts, receivables, and monthly reports. It is built as an offline-capable Progressive Web App (PWA), stores financial data locally in IndexedDB, and does not require an account or cloud sync.

[![Version](https://img.shields.io/badge/version-1.6.0-teal)](https://github.com/eiaiproject/Expend/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

## Live Demo

[Open Expend](https://expend.pages.dev/)

## Table of Contents

- [Why Expend](#why-expend)
- [Features](#features)
- [Privacy and Data Ownership](#privacy-and-data-ownership)
- [Backup and Restore](#backup-and-restore)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Available Scripts](#available-scripts)
- [Testing and Quality Checks](#testing-and-quality-checks)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

## Why Expend

Most personal finance tools require an account, remote sync, or server-side storage. Expend is designed for people who want private expense tracking on their own device:

- Local-first financial data storage
- Offline expense tracking after the first load
- Multi-wallet balance tracking
- Debt and receivable monitoring
- Budget alerts and spending analytics
- English and Indonesian language support

## Features

- **Expense tracking** - Record spending with categories, wallets, dates, notes, and payees.
- **Wallet management** - Track multiple wallet balances and transfer money between wallets.
- **Debt and receivable tracking** - Record payables, receivables, partial payments, write-offs, and due dates.
- **Budget monitoring** - Set monthly category budgets and get visual alerts near or over the limit.
- **Statistics and reports** - Review interactive charts, category drill-downs, and monthly reports.
- **Payee management** - Group and rename merchants or recipients across expense history.
- **CSV and JSON data tools** - Import/export transactions and full local backups.
- **Offline PWA support** - Install Expend on desktop or mobile for app-like access.
- **Privacy controls** - Optional PIN screen lock for casual access protection.
- **Internationalization** - Consistent English and Indonesian UI text.

## Privacy and Data Ownership

Expend stores data in the browser's IndexedDB database on the current device. There is no login system, remote database, cloud sync, or advertising tracker.

Important limitations:

- Clearing browser data or site storage permanently deletes local Expend data.
- PIN lock protects the app UI from casual access only.
- PIN lock does not encrypt IndexedDB data.
- Anyone with direct access to the browser profile may still be able to inspect local data.

For stronger protection, use encrypted devices, separate OS accounts, and encrypted backup storage.

## Backup and Restore

1. Open **Settings -> Data -> Export JSON** to download a full backup.
2. Store the JSON backup in a safe location.
3. Open **Settings -> Data -> Import JSON** to restore a backup.
4. Import replaces existing app data, while local PIN/security settings are preserved.

CSV import/export is available for transaction-focused workflows. JSON is the recommended format for full backup and restore.

## Tech Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Dexie.js and IndexedDB
- Recharts
- i18next and react-i18next
- Workbox and vite-plugin-pwa
- Vitest and Playwright

## Quick Start

```bash
git clone https://github.com/eiaiproject/Expend.git
cd Expend
npm install
npm run dev
```

The development server runs at `http://localhost:3000`.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the production app |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run i18n:check` | Verify locale key coverage |
| `npm run test:unit` | Run unit tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:e2e:chromium` | Run Playwright end-to-end tests in Chromium |
| `npm run audit` | Check for critical npm vulnerabilities |
| `npm run qa:automated` | Run lint, typecheck, i18n, unit tests, build, and Chromium E2E |

## Testing and Quality Checks

```bash
npm run lint -- --max-warnings=0
npm run typecheck
npm run i18n:check
npm run test:unit
npm run build
npm run test:e2e:chromium
```

Install Playwright browsers when running E2E tests on a fresh machine:

```bash
npm run playwright:install
```

## Deployment

```bash
npm run build
```

Deploy the `dist/` directory to a static host such as Cloudflare Pages, Netlify, Vercel, or GitHub Pages. The production build includes the app shell, PWA manifest, service worker, and optimized assets.

## Project Structure

```text
src/
|-- components/    # Shared UI components
|-- contexts/      # Theme and security providers
|-- db/            # IndexedDB schema, migrations, and repair logic
|-- hooks/         # React hooks
|-- i18n/          # English and Indonesian locale files
|-- services/      # Business logic and domain operations
|-- utils/         # Utility helpers and constants
`-- views/         # Route-level screens
```

## Troubleshooting

| Issue | Suggested fix |
| --- | --- |
| IndexedDB is unavailable | Disable private/incognito mode or use a supported browser profile |
| PWA install prompt does not appear | Use HTTPS or localhost and check browser install support |
| Service worker update is stuck | Clear site data in DevTools -> Application -> Storage |
| Data disappeared | Check whether browser/site storage was cleared and restore from JSON backup |
| E2E tests fail on a fresh machine | Run `npm run playwright:install` |

## Contributing

1. Fork the repository.
2. Create a branch: `git checkout -b feat/my-change`.
3. Make a focused change.
4. Run the relevant quality checks.
5. Commit using Conventional Commits, for example `fix: repair debt migration`.
6. Open a pull request.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Author

**Anggie Irawan** - [anggieirawan.my.id](https://anggieirawan.my.id) - [GitHub](https://github.com/eiaiproject)

## License

[MIT](LICENSE)
