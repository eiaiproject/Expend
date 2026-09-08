# Expend - Chat Expense Tracker

![version](https://img.shields.io/badge/version-0.13.2-teal)

Offline-first PWA. Navigation: **Summary** (transaction list) + **Record** (chat + OCR) + **Settings** (theme, data, privacy).

## Usage

### Chat
Type: `kopi di Indomaret 50000` → preview `Kopi di Indomaret · Rp50.000` → Save.

### OCR (Transfer Receipt)
Upload a photo of the transfer receipt → auto-detected → edit if needed → Save.

### Amount Format
`50000` `50.000` `50,000` `50rb` `50k` `1.5jt` `R P 50.000` (=`Rp`). A `dari|pakai|pake|via|from X` clause only becomes the funding source when `X` is known (`kopi 20rb dari kas` → source `Kas`); seller/location stays in the description (`nasi goreng dari warung Pak Eko 20rb` → description `Nasi Goreng dari Warung Pak Eko`, no source). Mid-sentence prepositions (`di`, `ke`, ...) are kept; a dangling preposition left after verb stripping is removed (`jajan di kantin` → `Kantin`). `ref/resi/trace/rekening` numbers are never picked as nominal. Max `1.000.000.000.000`; overflow/NaN rejected.

Transaction dates use the device's local timezone (local `YYYY-MM-DD`, not UTC) so `hari ini/kemarin` resolve correctly in WIB.

## Features

- **Chat-first**: Log expenses via natural language chat
- **Summary filter & grouping**: Filter by date range (Dari/Sampai), group by Day/Week/Month with per-group subtotals
- **Bilingual**: Bahasa Indonesia / English (auto-detect, switch in Settings)
- **Edit**: Update saved transactions inline from Summary
- **OCR**: Upload transfer receipts, auto-detected (JPG/PNG/WebP, max 10MB)
- **Offline-first**: All data stored locally in IndexedDB
- **Theme**: System / Light / Dark (via `data-theme`)
- **Export/Import**: JSON with format validation, plus CSV (`RFC4180`) and Excel (`.xlsx` via SheetJS) with date-range filter
- **Share target**: Send receipts from other apps directly to Expend
- **A11y**: Skip link, focus trap, aria labels, reduced motion

### Export
In **Settings → Data**: **Export JSON** (`expend-YYYY-MM-DD.json`, format `{version:1, transactions:[...]}`, legacy bare array accepted on import), **Export CSV** (`expend-YYYY-MM-DD.csv` RFC4180) and **Export Excel** (`expend-YYYY-MM-DD.xlsx` via SheetJS). Optional **From/To** (`YYYY-MM-DD`) filters by `date` inclusive; `From` after `To` and invalid dates are rejected with a toast; empty exports all in filename but empty result → error toast. CSV/XLSX string cells starting with `=+-@` are prefixed with `'` (OWASP, DB unchanged; `amount` stays numeric; no formula cells from user input). Import JSON is append-only with strict validation (reject corrupt/unknown-version/oversize `>5MB`/`>10k`/bad type/negative-NaN-overflow/bad date) and exact-duplicate skip (in-file + against DB). 100% offline — `Blob` + `URL.createObjectURL` + `a.click()`.

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
npx playwright test  # E2E (needs dev server, auto-started on :3000)
node scripts/full-audit.mjs  # Playwright pixel-perfect UI audit (needs dev server on :3000)
```

## Versioning

Semver + Conventional Commits per commit.
