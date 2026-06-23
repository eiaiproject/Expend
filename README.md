# Expend — PWA Expense Tracker

Local-first personal finance app for expense tracking, wallet management, and debt monitoring. Offline-capable, privacy-focused Progressive Web App.

[![Version](https://img.shields.io/badge/version-1.0.0-teal)](https://github.com/eiaiproject/Expend)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

## Quick Start

```bash
git clone https://github.com/eiaiproject/Expend.git
cd Expend
npm install
npm run dev
```

App runs at `http://localhost:3000`.

## Features

- **Expense Tracking** — Record spending with categories, wallets, dates, and notes
- **Wallet Management** — Multi-wallet balances with transfer support
- **Debt Tracking** — Monitor payables, receivables, and partial payments
- **Budget Monitoring** — Per-category spending limits with visual alerts
- **Statistics** — Interactive charts with drill-down and monthly reports
- **Offline-First** — Full functionality without internet connection
- **Multi-Language** — English and Indonesian support
- **Dark Mode** — Light and dark theme with semantic design tokens
- **PWA** — Installable on desktop and mobile devices

## Privacy

All data stored locally in IndexedDB. No accounts, no cloud sync, no ads. Financial data never leaves your device.

**Important:**
- Your data is stored entirely in the browser's IndexedDB database.
- **Deleting browser data or clearing site storage will permanently delete all Expend data.** Always keep backups.
- **PIN lock is UI protection only** — it prevents casual access to the app but does **not** encrypt the IndexedDB database. Anyone with technical access to the browser can still read the data.
- There is **no cloud sync, no login system, and no remote data storage.** Your financial data exists only on this device.

### Backup & Restore

1. Go to **Settings → Export Backup** to download a JSON file of all your data.
2. Store the backup file safely (e.g., external drive, encrypted cloud storage).
3. To restore, go to **Settings → Import Backup** and select your JSON file.
4. Import **replaces all existing data** with the backup contents (except PIN/security settings which are preserved locally).

### Offline & PWA

- After first load, the app works fully offline via Service Worker.
- Install as a PWA from your browser's install prompt for fullscreen, offline access.
- Updates are detected automatically and prompted when available.

## Tech Stack

React 19, TypeScript, Vite 6, Tailwind CSS 4, Dexie.js, Recharts, i18next, Workbox

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test:unit` | Run unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run qa:automated` | Run full QA pipeline (lint + typecheck + tests + build + e2e) |

### Running Tests

```bash
# Unit tests (runs reliably, no browser needed)
npm run test:unit

# E2E tests (requires Playwright browsers)
npx playwright install chromium
npm run test:e2e
```

### Building for Production

```bash
npm run build
```

The `dist/` directory contains the production build including:
- `sw.js` — Service Worker for offline/PWA support
- `manifest.webmanifest` — PWA manifest
- Optimized JavaScript and CSS bundles

## Documentation

- [Features & User Guide](#features)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Deployment

```bash
npm run build
```

Deploy the `dist/` directory to any static host: Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

## Project Structure

```
src/
├── components/    # UI components
├── contexts/      # Theme and security providers
├── db/            # IndexedDB schema and migrations
├── hooks/         # React hooks
├── i18n/          # Localization files
├── services/      # Business logic
├── utils/         # Helpers and utilities
└── views/         # Page components
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'feat: add amazing'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

[MIT](LICENSE)
