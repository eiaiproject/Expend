# Changelog

All notable changes to Expend are documented here.

## 1.5.1 - 2026-07-05

### Fixed

- Repaired legacy IndexedDB debt migration so old `debt_payments` data is normalized before Dexie opens.
- Restored category and wallet labels in payee transaction details.
- Scoped payee aggregation to expense transactions only.
- Removed duplicate error toasts from transaction submit failures.
- Localized debt and wallet deletion errors instead of showing raw service messages.
- Localized import validation toasts so English and Indonesian modes stay consistent.
- Fixed hard-coded date and landing preview copy that ignored the selected language.
- Prevented internal fallback category name `__OTHER__` from appearing in user-facing UI.
- Fixed duplicated debt progress percentage text.

### Changed

- Cleaned duplicate locale keys and expanded English/Indonesian translations.
- Updated README positioning, setup documentation, quality commands, and SEO-focused description.
- Improved Open Graph, Twitter card, and canonical metadata for the web app.

### Verified

- `npm run lint -- --max-warnings=0`
- `npm run typecheck`
- `npm run i18n:check`
- `npm run test:unit`
- `npm run build`
- `npm run test:e2e:chromium`

## 1.5.0 - 2026-07-05

### Added

- Payee grouping and rename workflows.
- Debt and receivable improvements.
- Mobile interaction and accessibility improvements.
- Expanded automated regression coverage.
