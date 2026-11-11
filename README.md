# Expend

[![version](https://img.shields.io/badge/version-0.20.1-teal)](https://github.com/eiaiproject/Expend/releases)
[![CI](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml/badge.svg)](https://github.com/eiaiproject/Expend/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-teal.svg)](LICENSE)

**Expend is a local-first expense tracker that runs in your browser.** Write an
expense the way you would say it, or upload a receipt, and Expend turns it into
a structured transaction. There is no account, no application server, and no
analytics. Transactions stay in IndexedDB on your device by default.

![Expend social card](public/og-image.png)

## Why Expend

Recording a coffee should not require a login form and four dropdowns. Expend
is built for quick entry in Bahasa Indonesia or English, including on a phone
and without a stable connection. It installs as a PWA and works offline after
the app shell and the OCR assets have been cached.

## Features

| Area | What the app does |
| --- | --- |
| Record | Parses description, amount, date, source of funds, and note from natural language |
| Receipts | Reads transfer, shop, and QRIS receipts with on-device Tesseract.js OCR |
| Summary | Search, date filters, day/week/month grouping, group totals, inline edit, soft delete and undo |
| Data | JSON backup/restore, CSV export, and import of JSON, CSV, or XLSX |
| Optional AI | A user-supplied OpenAI-compatible vision endpoint can extract receipts before local OCR fallback |
| Privacy | Local by default, no tracking, no external OCR CDN in production builds |
| Accessibility | Skip link, focus trap, 48 px targets, high contrast, three font sizes, reduced motion |
| Language | Bahasa Indonesia and English, switchable in Settings |

## Quick start

Node.js 22 or newer is required.

```bash
npm ci --ignore-scripts
npm run vendor:ocr   # once: copy the OCR worker, core, and ind/eng models into public/
npm run dev          # http://localhost:3000
```

`npm run vendor:ocr` also runs as part of `prebuild`, so production builds serve
OCR assets from the same origin.

## Using Expend

### Record with a sentence

Open **Record** (Catat) and type:

| Input | Result |
| --- | --- |
| `kopi di Indomaret 50000` | `Kopi di Indomaret`, Rp50.000 |
| `makan siang 30rb kemarin` | `Makan Siang`, Rp30.000, yesterday |
| `kopi 20rb dari kas` | source `Kas` |
| `nasi goreng dari warung Pak Eko 20rb` | seller stays in the description, no source |
| `kopi 25rb note untuk rapat` | note `untuk rapat` |
| `kopi 50` | rejected: plain numbers below Rp100 are treated as noise |

Amounts can be written as `50000`, `50.000`, `50,000`, `50rb`, `50k`, `1.5jt`,
or `Rp 50.000`. The accepted range is Rp1 to Rp1.000.000.000.000. Relative dates
use the device's local timezone, so `hari ini` and `kemarin` resolve correctly in
WIB.

### Record from a receipt

Upload a JPG, PNG, or WebP image up to 10 MB. The image must also be at most
40 megapixels. OCR runs on the device. The parser prefers a labelled final total
over components and does not treat cash tendered or change as the amount. On QRIS
receipts the merchant becomes the description. Top-up receipts use the saldo as
the amount. A `Catatan:` or `Note:` line becomes the note. OCR-confusable digits
such as `1O.000` are rejected rather than silently guessed.

To use the optional AI path, open **Settings > AI assistant (BYOK)** and enter a
valid HTTPS OpenAI-compatible base URL, API key, and model. With AI configured,
Expend sends the compressed receipt image to that endpoint first and falls back
to local OCR if the request fails. The API key stays in this browser's
`localStorage` and is excluded from exports and backups. The provider receives
the image only while AI is configured and enabled. Disconnect AI in Settings to
return to fully local processing.

The first OCR run downloads the worker, core, and both language models from
Expend's own origin, about 12 MB in total. Later runs use the service worker
cache, so OCR can work offline.

### Review, back up, and import

**Summary** (Ringkasan) lists active transactions newest first. Search
descriptions, filter by date, group by day/week/month, and edit or delete a row.
Deleting is a soft delete with an undo action.

**Settings** contains Preferences, AI assistant (BYOK), Language, Data, Privacy,
About, and Danger Zone. From Data you can export JSON or CSV, import JSON, CSV,
or XLSX, set a local backup reminder, or download a JSON backup. The export
wizard supports an optional date range. XLSX import reads only the `Transaksi`
sheet and ignores operational sheets such as `Log`.

## Data and privacy

- Transactions live in IndexedDB in your browser profile. Expend does not upload
  them.
- JSON export is the backup format. It uses a versioned schema and records the
  app version. CSV is for spreadsheets.
- Import is append-only. Every row is validated, exact duplicates are skipped,
  and XLSX reads the `Transaksi` sheet only.
- BYOK configuration is stored in `localStorage`. When AI is enabled, receipt
  images are sent to the endpoint you configured, subject to that provider's
  retention policy.
- Data is **not encrypted at rest**. Anyone with access to the browser profile or
  device can read it. Clearing site data removes the local transactions.
- Backup reminders are local timestamps in `localStorage`; there is no cloud
  sync.
- The permanent erase control is in **Settings > Danger Zone**.

See the [threat model](docs/THREAT_MODEL.md) for the accepted risks.

## Tech stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, Dexie 4, React Router 7,
Tesseract.js 7, read-excel-file, vite-plugin-pwa, and reicon-react.

## Project layout

```text
src/views/       Summary, Record, and Settings screens
src/components/  Shared dialogs, navigation, feedback, and export UI
src/db/          Dexie schema and migrations
src/utils/       Parsers, OCR, AI, export/import, dates, grouping, backup
src/i18n/        Indonesian and English dictionaries
public/          Icons, social image, share handler, and vendored OCR assets
tests/unit/      Vitest suites and fixtures
tests/e2e/       Playwright flows and the visual audit
scripts/         Version sync, release, Tesseract vendoring, lint guards
docs/            Architecture, threat model, Dexie notes, import format, notices
```

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000, localhost only |
| `npm run dev:lan` | Bind the dev server to `0.0.0.0` for phone testing |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript over source, tests, and config |
| `npm run lint` | ESLint |
| `npm run lint:prose` | Reject em dashes in prose and comments |
| `npm run test` | Vitest in watch mode |
| `npm run test:unit` | Run unit tests once |
| `npm run test:coverage` | Unit tests with coverage |
| `npx playwright test` | E2E and visual audit, starts the dev server |

The Playwright visual audit checks four viewports across the three routes for
overflow, touch targets, padding, and contrast.

## Versioning and releases

Expend uses SemVer and Conventional Commits. After CI is green, a merge to
`main` releases according to the highest change since the last release:
breaking changes are MAJOR after 1.0 (MINOR while the package is 0.x), `feat` is
MINOR, and `fix`, `perf`, `refactor`, and `revert` are PATCH. `docs`, `test`,
`ci`, `build`, `style`, and `chore` commits do not cut a release on their own.

`package.json` is the only hand-written version. Vite injects it into the UI as
`__APP_VERSION__`, so the version shown in **Settings > About** always matches
the package. `scripts/sync-version.mjs` updates the README badge and CHANGELOG,
and `scripts/auto-release.mjs` creates the release commit and tag. The export
schema and IndexedDB schema are versioned separately.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Dexie migrations](docs/dexie-migrations.md)
- [Spreadsheet import](docs/sheets-import.md)
- [Third-party notices](docs/THIRD_PARTY_NOTICES.md)

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report
vulnerabilities through GitHub private vulnerability reporting as described in
[SECURITY.md](SECURITY.md). Participation is covered by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT. See [LICENSE](LICENSE).
