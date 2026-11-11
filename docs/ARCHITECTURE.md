# Architecture

Expend is a static single-page application. There is no application server and
no account system. The browser owns the data and the build produces static files
for Cloudflare Pages.

## Runtime

- React 19 with React Router routes: `/`, `/chat`, `/settings`.
- Vite builds the bundle. `vite-plugin-pwa` generates the service worker and
  manifest.
- Dexie 4 wraps IndexedDB. The database name is `ExpendDB`.
- Tesseract.js runs OCR in a web worker from assets under `/tesseract/`.
- `read-excel-file` is imported dynamically only when an `.xlsx` file is chosen.
- `public/share-handler.js` is imported into the service worker and accepts the
  PWA share target POST.

## Data flow

1. Chat input is parsed by `src/utils/chatParser.ts` into description, amount,
   source, date, and note.
2. The user confirms in the pending card. `saveNow` writes a transaction, an
   audit row, and chat messages in one Dexie transaction.
3. Receipt uploads pass file size, MIME, magic-byte, and pixel-budget checks.
   If BYOK is configured, `src/utils/ai.ts` sends a compressed image to the
   chosen OpenAI-compatible endpoint and validates the JSON result. Any AI
   failure falls back to local Tesseract OCR and the receipt parser. Both paths
   produce the same pending shape.
4. Summary reads active transactions, filters and groups them in memory, and
   renders grouped rows. Export reads active rows only.
5. Import parses JSON, Sheets CSV, or XLSX, validates every field, and writes
   fresh rows in one Dexie transaction. Duplicate keys are skipped inside that
   same transaction. XLSX reads only the `Transaksi` sheet through a dynamically
   imported `read-excel-file` chunk.

## IndexedDB schema

Schema version 4 in `src/db/db.ts`:

| Store | Purpose | Indexes |
| --- | --- | --- |
| `transactions` | Expense rows | `date`, `createdAt`, `amount`, `source`, `deletedAt` |
| `chatMessages` | Chat history, capped at 500 | `role`, `createdAt`, `txId` |
| `transactionAudit` | Append-only create/update/delete/restore snapshots | `txId`, `at` |

Soft delete sets `deletedAt` and keeps the row. Update sets `updatedAt`. The
audit row stores the snapshot before and, where useful, after the change. The
danger zone uses `clearAllData` for a permanent local erase.

## OCR pipeline

- Assets are copied by `scripts/vendor-tesseract.mjs` during `prebuild`.
- Language models are verified with SHA-256. CI fails if an asset is missing or
  corrupt.
- `src/utils/ocr.ts` reads image dimensions from PNG, JPEG, or WebP headers
  before decoding. Images above 40 MP are rejected.
- Images above 1000 px on either axis are resized before recognition.
- OCR runs from the same origin. The service worker caches assets with a
  CacheFirst strategy after first use.

## BYOK AI pipeline

- Configuration (`baseUrl`, `apiKey`, `model`) is stored in `localStorage`.
  It is not part of JSON/CSV exports or backups.
- The endpoint must be OpenAI-compatible and use a Bearer token. HTTPS is
  required except for localhost.
- `model: auto` calls `/models`, filters models whose metadata includes image
  input, and picks the first match. Providers without modality metadata require
  an explicit model name.
- Receipt images are resized to at most 1280 px and encoded as JPEG data URLs.
  The API key is sent only to the configured origin.
- The browser calls the provider directly, so the provider must allow CORS.
  A CORS failure is reported in Settings and falls back to local OCR.
- AI output is validated with the same amount/date bounds as spreadsheet import
  before it becomes a pending transaction.

## Security boundaries

- Without AI, no transaction data is sent to a server. With BYOK enabled,
  receipt images go to the provider chosen by the user.
- CSP, HSTS, `nosniff`, `Referrer-Policy`, `frame-ancestors`, and a restrictive
  Permissions Policy are declared in `public/_headers` for production.
- The theme bootstrap is an external same-origin script so `script-src` does not
  need `unsafe-inline`. The only inline script is the static JSON-LD block, which
  is allowed by hash.
- Share cache entries are deleted after processing and on every error path.
- JSON import uses an allowlist of fields and bounded sizes. CSV export
  neutralizes formula injection.

See `docs/THREAT_MODEL.md` for assets, actors, and accepted risks.

## Build and release

- `npm run build` runs `prebuild` first to vendor OCR assets.
- Unit tests use Vitest with `fake-indexeddb`.
- Playwright covers the main flows and a visual audit. Receipt fixtures are
  generated at runtime, so E2E does not depend on gitignored images.
- CI runs lint, prose check, typecheck, coverage, and build. E2E runs against a
  locally vendored OCR asset set.
- `release` runs after CI and E2E on `main`. `deploy` waits for `release`, then
  checks out the latest `main` so the deployed build includes the version bump.
- Cloudflare Pages receives the `dist` directory through `wrangler-action`.

## Failure modes

| Failure | Behavior |
| --- | --- |
| IndexedDB read fails | `DbErrorNotice` with retry; the app does not show an endless skeleton |
| Render error | Global `ErrorBoundary` with reload and Settings actions |
| OCR model missing | Build fails in CI; local dev falls back to CDN with a warning |
| Storage eviction risk | Settings shows persistent or best-effort status; backup banner remains |
| Import quota exceeded | Generic toast; no partial import because the write is transactional |
| XLSX sheet missing | Import is rejected; no partial write |
| AI endpoint/auth/model fails | Toast once per session; local OCR continues |
| Provider blocks browser CORS | Settings test reports it; local OCR remains available |
| Service worker stale | `registerType: autoUpdate`; reload picks up the new shell |
