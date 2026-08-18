# Changelog

All notable changes to Expend are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and this project
adheres to [Semantic Versioning](https://semver.org/).

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
