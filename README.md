# Expend - Chat Expense Tracker

![version](https://img.shields.io/badge/version-0.10.0-teal)

Offline-first PWA. Navigation: **Summary** (transaction list) + **Record** (chat + OCR) + **Settings** (theme, data, privacy).

## Usage

### Chat
Ketik: `kopi di Indomaret 50000` → preview `Kopi di Indomaret · Rp50.000` → Save.

### OCR (Transfer Receipt)
Upload a photo of the transfer receipt → auto-detected → edit if needed → Save.

### Amount Format
`50000` `50.000` `50rb` `50k` `1.5jt`. Clause `dari|pakai|pake|via ...` is automatically ignored; prepositions (`di`, `ke`, ...) stay in the description.

## Features

- **Chat-first**: Log expenses via natural language chat
- **Edit**: Update saved transactions inline from Summary
- **OCR**: Upload transfer receipts, auto-detected (JPG/PNG/WebP, max 10MB)
- **Offline-first**: All data stored locally in IndexedDB
- **Theme**: System / Light / Dark (via `data-theme`)
- **Export/Import**: JSON with format validation, plus CSV (`RFC4180`) and Excel (`.xlsx` via SheetJS) with date-range filter
- **Share target**: Send receipts from other apps directly to Expend
- **A11y**: Skip link, focus trap, aria labels, reduced motion

### Export
In **Settings → Data**: **Export JSON** (existing `expend-YYYY-MM-DD.json`), **Export CSV** (`expend-YYYY-MM-DD.csv` RFC4180) and **Export Excel** (`expend-YYYY-MM-DD.xlsx` via SheetJS). Optional **From/To** (`YYYY-MM-DD`) filters by `date` inclusive; empty exports all. No transactions → error toast. 100% offline — `Blob` + `URL.createObjectURL` + `a.click()`.

## Stack

React 19 + Vite 6 + Tailwind 4 + Dexie 4 (IndexedDB) + React Router 7 + Tesseract.js (OCR) + SheetJS (Excel) + vite-plugin-pwa + `reicon-react`. Icons 100% `reicon.dev`.

## Components

`PageHeader` · `SectionCard` · `EmptyState` · `ConfirmDialog` · `Toast` · `InlineAlert` · `SkeletonCard` · `PrimaryButton` · `SecondaryButton` · `IconButton` · `StatusBadge` · `BottomNav` · `SidebarNav` · `PageContainer`

## Scripts

```bash
npm run dev          # Vite dev server (port 3000)
npm run build        # Production build
npm run clean        # Remove dist directory
npm run preview      # Vite preview server
npm run typecheck    # TypeScript check
npm run test         # Vitest watch
npm run test:unit    # Vitest single run
npm run lint         # ESLint
node scripts/full-audit.mjs  # Playwright pixel-perfect UI audit (needs dev server on :3000)
```

## Versioning

Semver + Conventional Commits per commit.
