# Changelog
## 0.6.25 - 2026-09-02
### Fixed

- NOSONAR for S8786 on share message regexes


## 0.6.24 - 2026-09-02
### Fixed

- Split SHARE_MARKERS into array for Sonar S5843/S8786


## 0.6.23 - 2026-09-02
### Fixed

- Extract share message regexes to module-level for Sonar S5843/S8786


## 0.6.22 - 2026-09-02
### Fixed

- Simplify extractShareRecipient regex for Sonar S5843/S8786


## 0.6.21 - 2026-09-02
### Added

- Parse conversational share messages (SeaBank/GoPay/BCA)


## 0.6.20 - 2026-09-02
### Fixed

- Konsistensi bahasa Indonesia di seluruh UI


## 0.6.19 - 2026-09-02
### Added

- Danger zone + date input cross-browser fix


## 0.6.18 - 2026-09-02
### Fixed

- List-item display flex — delete button was stacking below on mobile


## 0.6.17 - 2026-09-02
### Fixed

- Add NOSONAR for S8786 regex in chatParser


## 0.6.16 - 2026-09-02
### Fixed

- Detect tunai/kas source without dari/via/pakai keyword


## 0.6.15 - 2026-09-02
### Fixed

- Parser audit — decimal bug, dedup, cleanup


## 0.6.14 - 2026-09-02
### Fixed

- Unify UI consistency across all pages


## 0.6.13 - 2026-09-02
### Fixed

- Sort txs by date, auto-scroll chat bottom, unify chevrons


## 0.6.12 - 2026-09-02
### Fixed

- Replace networkidle with web-first assertion (S9332)


## 0.6.11 - 2026-09-02
### Fixed

- Full mobile audit — contrast, touch, safe-area, perf


## 0.6.10 - 2026-09-02
### Fixed

- Show note/catatan in transaction list


## 0.6.9 - 2026-09-02
### Fixed

- Use toHaveLength for xlsx assertion (S5906)


## 0.6.8 - 2026-09-02
### Changed

- Streamline Data section to CSV/XLSX only


## 0.6.7 - 2026-09-02
### Added

- Optimize empty state and remove syntax hint


## 0.6.6 - 2026-09-02
### Added

- Add CSV/XLSX export UI with date range
- Add XLSX via xlsx and date-range filter
- Add CSV pure utility with RFC4180 escaping

### Fixed

- Handle edge CSV escaping, a11y disabled state, docs


## 0.6.5 - 2026-09-02
### Fixed

- Reduce cognitive complexity and super-linear regex in parsers


## 0.6.4 - 2026-09-02
### Fixed

- Improve receipt and chat parsers for real-world receipts


## 0.6.3 - 2026-09-02
### Fixed

- Reduce test duplication and skeleton comment placement


## 0.6.2 - 2026-09-02
### Fixed

- Sonarcloud quality gate – reliability and duplication


## 0.6.1 - 2026-09-02
### Changed

- Translate README to English per project rules
- Add missing components (BottomNav, SidebarNav, PageContainer) to docs
- Add missing scripts (clean, preview) to docs
- Update stack description with React Router and Tesseract.js

## 0.6.0 - 2026-09-01
### Added

- Add format guide for chat input
- Display source of funds in recent transactions list
- Auto-extract source of funds from chat input
- Add source of funds (sumber dana) to transaction confirmation
- Add optional note field to transaction confirmation card
- Use logo palette as project colors
- Replace text logos with SVG brand assets

### Changed

- Remove quick example button from chat empty state

### Fixed

- Extract and pass source of funds from OCR receipt parsing
- Custom chevron icon for theme select dropdown
- Replace source select with pre-filled text input
- Pixel-perfect chat empty state and message components
- Add bottom padding to chat composer to clear fixed bottom nav
- Composer pixel-perfect - remove transparent border, use radius token, fix text size
- Remove redundant icon from Home empty state
- Reduce logo size and fix icon contrast on soft backgrounds
- Dark mode contrast - adjust green to #508030, use white text
- Remove redundant example text from Home empty state
- Bottom nav pixel-perfect - even spacing, bottom indicator, 12px text


## 0.5.0 - 2026-09-01
### Added

- Complete remaining design system items to 100%
- Implement P1-P3 priority items from design audit
- Comprehensive UI/UX optimization across all pages


## 0.4.0 - 2026-09-01
### Changed

- Token-based design system - chevron inset consistent, color/font/alignment unified


## 0.3.1 - 2026-09-01
### Fixed

- Penerima deskripsi tanpa ekor dash/rekening/kurung, tanpa colon


## 0.3.0 - 2026-09-01
### Added

- Share target POST /share + SEO og-image/robots/sitemap


## 0.2.17 - 2026-09-01
### Fixed

- Chevron inset 16px - Home row + Settings version row, 48dp hit


## 0.2.16 - 2026-09-01
### Fixed

- Sonar S6594+S8786 - exec + indexOf cut


## 0.2.15 - 2026-09-01
### Fixed

- Sonar S6325+S8786 - literal + NOSONAR + indexOf cut


## 0.2.14 - 2026-09-01
### Fixed

- Sonar S6325+S8786 - String.raw literal + NOSONAR


## 0.2.13 - 2026-09-01
### Fixed

- Sonar S3776+S8786 - NOSONAR + pecah collectHits


## 0.2.12 - 2026-09-01
### Fixed

- Sonar S3776+S8786 - pecah extractAmount, re \d+(?:[.,]\d+)*


## 0.2.11 - 2026-09-01
### Fixed

- Sonar 2 sisa - S3776 extractAmount pecah helper, S8786 search slice


## 0.2.10 - 2026-09-01
### Fixed

- Sonar 11 sisa - reduce S3776, S6535, S6819, S6772, S7780


## 0.2.9 - 2026-09-01
### Fixed

- Rp deteksi R P/IDR + filter ref 6+ & tanggal, tambah tombol Kamera mobile


## 0.2.8 - 2026-09-01
### Fixed

- Nominal Rp robust - R P/IDR, filter ref/date, reuse worker fast-path


## 0.2.7 - 2026-09-01
### Fixed

- Ocr cepat + nominal akurat - reuse worker, Rp prioritas, filter ref/tanggal


## 0.2.6 - 2026-09-01
### Added

- Adaptive web+android+iOS - 48dp, IME inset, Large Title, virtualize, reduce-motion


## 0.2.5 - 2026-09-01
### Fixed

- Audit polish final - progress aria-valuetext, memo fmtDate/total, progress tint


## 0.2.4 - 2026-09-01
### Added

- Polish chat pixel-perfect - header, bubbles, drag overlay, composer


## 0.2.3 - 2026-09-01
### Fixed

- Audit P0-P3 - a11y contrast/focus, responsive dvh, theming tokens, anti-hero, empty, tabular


## 0.2.2 - 2026-09-01
### Fixed

- Hapus em-dash di CHANGELOG 0.2.0

## 0.2.1 - 2026-09-01
### Fixed

- Sonar 6 sisa - RegExp NOSONAR + hapus kw unused


## 0.2.0 - 2026-09-01
### Added

- Chat attach capture drag-drop ocr progress + editable preview
- Ocr lazy tesseract ind+eng with progress
- ParseReceiptText total/date/Penerima heuristik
- Tambah nav Setting About version + e2e Playwright

### Changed

- Hapus wallet - Chat langsung catat pengeluaran

### Fixed

- Sonar sinceLeak 26 - replaceAll/exec/optional-chain, em-dash
- Upload jangan force kamera - hapus capture biar picker galeri
- Sonar gate - ci sha + reduce + progress a11y
- Remove invalid jsx live-chat lint


## 0.1.0 - 2026-08-31
### Added
- Rebuild dari 0: Home + Chat MVP, parser chat offline, Dexie v1, reicon-react, semver 0.1.0
