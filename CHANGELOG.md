# Changelog

All notable changes to Expend are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and this project
adheres to [Semantic Versioning](https://semver.org/).

## 1.18.1 - 2026-08-21

## 1.18.0 - 2026-08-20
### Added

- OCR scan-to-form from screenshots
- Detect recurring expenses and suggest schedules
- Web share target prefills transaction form
- Paste batch entry
- Recent payees quick-add chips on home
- Save & add another for quick add
- Payee-aware amount presets
- Optional silent category creation setting

### Fixed

- Visible delete button on template chips
- Process due schedules on date rollover while app is open
- Quick-add falls back to last-used category
- Warn before saving a likely duplicate transaction
- Decimal-safe, caret-preserving amount input


## 1.17.0 - 2026-08-18

### Added

- Delay prompt reveal after positive moments
- Memoize payee stats reads for 10s
- PayeePickerSheet + click-outside dismissal
- MutationObserver dedupes duplicate SVG clipPath ids

### Changed

- Tune semantic color tokens for AA contrast; a11y tap targets; design polish
- Extract overflow-menu and status-icon subcomponents from cards

### Fixed

- Playwright retries + drop reload waits (B3)
- Deterministic category color assignment
