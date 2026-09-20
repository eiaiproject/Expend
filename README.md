# Expend - Chat Expense Tracker

![version](https://img.shields.io/badge/version-0.19.2-teal)

Offline-first PWA. Navigation: **Summary** (transaction list) + **Record** (chat + OCR) + **Settings** (theme, data, privacy).

## Usage

### Chat
Type: `kopi di Indomaret 50000` → preview `Kopi di Indomaret · Rp50.000` → Save.

### OCR (Transfer Receipt)
Upload a photo of the transfer receipt → auto-detected → edit if needed → Save. On shop receipts, the labelled final total wins over every component and over cash tendered/change: `Total` beats `Subtotal` even when a discount makes it smaller (`Subtotal Rp 100.000` + `Diskon Rp 10.000` + `Total Rp 90.000` → Rp 90.000), and `Tunai` / `Kembalian` never become the amount (a receipt showing only `Kembalian` parses to nothing). On QRIS merchant receipts the store name is used as description (`TYA BUAH 2`, not the acquirer bank), and the sending bank wins over the acquirer bank when both appear. Top-up receipts use the saldo (`Isi Saldo` / `Top Up` → amount = `Saldo Rp 100.000`, description `Top Up`). A `Catatan:` / `Note:` line becomes the transaction note.

OCR runs on assets shipped from our own origin (`public/tesseract/`, produced by `scripts/vendor-tesseract.mjs` on `prebuild`/`npm run vendor:ocr`): worker, SIMD/plain LSTM core, and the `ind`+`eng` models. No request ever goes to `cdn.jsdelivr.net` or `tessdata.projectnaptha.com`. The worker and core are fetched on first OCR (~8 MB with both models) and then held by the Service Worker (`ocr-cache`, CacheFirst) plus tesseract's own IndexedDB cache, so OCR works fully offline from the second use onward. `tests/e2e/ocr-offline-assets.spec.ts` proves it by aborting every non-localhost request and asserting the run still succeeds.

OCR damage is never guessed: a number fused with a letter (`1O.000`, `l00.000`) is rejected — the receipt yields no amount so you type it yourself instead of saving a wrong one. Non-IDR receipts (`$`, `€`, `USD`) are rejected consistently rather than silently recorded as rupiah. The whole receipt is parsed from one 4000-character window, so a date or total near the bottom of a long QRIS receipt is still read.

### Amount Format
`50000` `50.000` `50,000` `50rb` `50k` `1.5jt` `R P 50.000` (=`Rp`). A `dari|pakai|pake|via|from X` clause only becomes the funding source when `X` is known (`kopi 20rb dari kas` → source `Kas`); seller/location stays in the description (`nasi goreng dari warung Pak Eko 20rb` → description `Nasi Goreng dari Warung Pak Eko`, no source). Mid-sentence prepositions (`di`, `ke`, ...) are kept; a dangling preposition left after verb stripping is removed (`jajan di kantin` → `Kantin`). `ref/resi/trace/rekening` numbers are never picked as nominal. Plain numbers below Rp 100 without `Rp`/suffix are rejected (smallest circulating coin is Rp 100, so `Kopi 50` parses to nothing instead of Rp 50). Max `1.000.000.000.000`; overflow/NaN rejected.

Transaction dates use the device's local timezone (local `YYYY-MM-DD`, not UTC) so `hari ini/kemarin` resolve correctly in WIB.

## Features

- **Chat-first**: Log expenses via natural language chat
- **Summary filter & grouping**: Filter by date range (Dari/Sampai), group by Day/Week/Month with per-group subtotals
- **Bilingual**: Bahasa Indonesia / English (auto-detect, switch in Settings)
- **Edit**: Update saved transactions inline from Summary
- **OCR**: Upload transfer receipts, auto-detected (JPG/PNG/WebP, max 10MB)
- **Offline-first**: All data stored locally in IndexedDB; OCR assets served from our own origin and cached after first use
- **Theme**: Light / Dark (first run follows the OS, then persisted via `data-theme`)
- **Export/Import**: JSON with format validation, plus CSV (`RFC4180`) with date-range filter
- **Share target**: Send receipts from other apps directly to Expend
- **A11y**: Skip link, focus trap, aria labels, reduced motion

### Export
In **Settings → Data**: **Export JSON** (`expend-YYYY-MM-DD.json`, format `{version:1, transactions:[...]}`, legacy bare array accepted on import) and **Export CSV** (`expend-YYYY-MM-DD.csv` RFC4180). Optional **From/To** (`YYYY-MM-DD`) filters by `date` inclusive; `From` after `To` and invalid dates are rejected with a toast; empty exports all in filename but empty result → error toast. CSV string cells starting with `=+-@` are prefixed with `'` (OWASP, DB unchanged; `amount` stays numeric; no formula cells from user input). Import JSON is append-only with strict validation (reject corrupt/unknown-version/oversize `>5MB`/`>10k`/bad type/negative-NaN-overflow/bad date) and exact-duplicate skip (in-file + against DB). 100% offline - `Blob` + `URL.createObjectURL` + `a.click()`.

## Stack

React 19 + Vite 6 + Tailwind 4 + Dexie 4 (IndexedDB) + React Router 7 + Tesseract.js (OCR) + vite-plugin-pwa + `reicon-react`. Icons 100% `reicon.dev`.

## Components

`PageHeader` · `SectionCard` · `EmptyState` · `ConfirmDialog` · `Toast` · `InlineAlert` · `SkeletonCard` · `BottomNav` · `SidebarNav` · `ExportWizard` · `FormatCheatSheet` · `LiveParseFeedback` · `OcrGuideOverlay` · `OnboardingCoach` · `QuickToggles` · `Wordmark`

## Scripts

```bash
npm run dev          # Vite dev server (port 3000)
npm run vendor:ocr   # Copy Tesseract worker/core + ind/eng models to public/tesseract (run once for offline OCR in dev)
python3 scripts/optimize-og.py  # Re-compress public/og-image.png after regenerating it from scripts/og-card.html
npm run build        # Production build
npm run clean        # Remove dist directory
npm run preview      # Vite preview server
npm run typecheck    # TypeScript check
npm run test         # Vitest watch
npm run test:unit    # Vitest single run
npm run lint         # ESLint
npx playwright test  # E2E (needs dev server, auto-started on :3000)
```

`npm run typecheck` covers `src`, `tests`, and the root configs. `tests/e2e/visual-audit.spec.ts` audits all 4 viewports x 3 routes (touch targets, text overflow, padding, contrast) and **fails** on anything outside its `INTENTIONAL` list — add an entry there only with a written reason, never by loosening a threshold.

## Versioning

Semver + Conventional Commits per commit. Merges to `main` cut a release automatically once CI for that commit is green (the `release` job in `ci.yml` calls `release.yml` as a reusable workflow, then `scripts/auto-release.mjs`): highest bump wins (breaking to MAJOR once 1.0 ships, MINOR while on 0.x; `feat` to MINOR; `fix`/`perf`/`refactor`/`revert` to PATCH).

`package.json` is the only version written by hand. Everything else is derived, so there is nothing to bump manually:

| Surface | Source |
| --- | --- |
| UI badge (Settings → About) | `__APP_VERSION__` defined in `vite.config.ts`, read via `src/config/version.ts` |
| README badge, CHANGELOG entry | `scripts/sync-version.mjs` (npm `version` hook) |
| Git tag + release commit | `scripts/auto-release.mjs` |

Two further version axes are deliberately **not** the app semver, because they must move monotonically rather than with releases: `EXPORT_FORMAT_VERSION` in `src/config/version.ts` governs the exported JSON payload (`version`) and changes only when that schema does, and `db.version(N)` in `src/db/db.ts` governs the IndexedDB schema (`docs/dexie-migrations.md`).

`tests/unit/version.test.ts` fails the build when these drift (manual bump without the `version` hook, badge/CHANGELOG left behind, or a hardcoded version in UI/export).
