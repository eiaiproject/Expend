# Changelog

All notable changes to Expend are documented here.

## 1.11.3 - 2026-07-27
### Fixed

- Reduce cognitive complexity in db.ts, useTransactionForm, and WalletsView
- Remove unused TransactionCard import, add readonly to TransactionGroup props
- Remove redundant onViewDetail prop from TransactionGroup
- Extract TransactionGroup component to reduce function nesting depth (S2004)
- Remove aria-selected from empty-state div in CategorySelect
- Flatten impactColor ternary to if/else chain in DebtFormSheet
- Resolve 7 SonarCloud PR#10 issues — S3358 nested ternary, S2004 function nesting, S6811 aria-selected
- Resolve SonarCloud main branch issues — S6822 redundant role, S6819 listbox/group, S3358 nested ternary, S7924 contrast, S6847 dialog events
- Resolve 88 SonarCloud issues — S6819 a11y roles, S3358 nested te… (#8)


## 1.11.2 - 2026-07-27
### Fixed

- Remove unused eslint-disable directive causing CI lint failure
- Resolve 88 SonarCloud issues — S6819 a11y roles, S3358 nested ternaries, S3776 cognitive complexity, S2681 conditionals, S6852 focus, S6754 useState
- Resolve remaining S3776 cognitive complexity violations (DebtFormSheet, TransactionCard, WalletsView, transactionSaveService)
- Replace ARIA role="dialog" with native `<dialog>` across all modal components
- Convert role="list"/"listitem"→`<ul>`/`<li>`, role="region"→`<section>`, role="search"→`<search>`, role="group"→`<fieldset>`
- Fix S6848/S6847 non-native interactive elements (ConfirmDialog, DrillDownModal backdrop)
- Add comprehensive interactive Playwright e2e tests covering all 11 pages


## 1.11.1 - 2026-07-24
### Fixed

- Batch 2 — mechanical SonarCloud fixes (27 issues) (#6)
- Resolve SonarCloud issues batch 1 — imports, button types, usele… (#5)


## 1.11.0 - 2026-07-20
### Added

- Add scroll-fade-bottom utility class
- Add bottom scroll-fade indicator to FilterSheet

### Changed

- Migrate all icons from lucide-react to reicon-react
- Migrate App.tsx icons to reicon-react

### Fixed

- Wrap FAB in pointer-events-none so it stops blocking transaction card actions
- Reposition filter count badge to avoid overflow
- Tighten BottomNav spacing for narrow screens


## 1.10.2 - 2026-07-16

### Fixed

- E2E tests: align selectors with refactored SettingsView (accordions for Backup/Restore & CSV Import/Export, directly visible Security section).
- E2E tests: align DebtFormSheet step-1 heading selector (`"I owe someone"` instead of stale `"I Owe Money"`).
- E2E tests: align CategoryOverflowMenu rename flow (open menu → click `"Rename Merchant"` menuitem).
- E2E tests: align WalletOverflowMenu delete menuitem label (`"Delete"` instead of `"delete permanently"`).
- E2E tests: align DebtDetailSheet mark-settled button label (`"Mark as Settled"` instead of `"Paid"`).

## 1.10.1 - 2026-07-05

### Refactored

- `categoryDisplay.ts` removed; `FALLBACK_CATEGORY_NAME` inlined into `constants.ts`.
- `transferUtils.ts`: drop legacy transfer-pair fuzzy fallback; keep `transferGroupId` indexed path only.
- `cryptoUtils.ts`: deduplicated crypto helpers (`bufferToHex`, `hexToUint8Array` inlined into `pbkdf2Hex`/`sha256Hex`).
- `db/db.ts`: deduplicated repeated Dexie store-string definitions; migrations consolidated where version numbers didn't change schema.
- `WalletsView.tsx`: remove manual dynamic-import wrapper; use direct static import (chunk already loaded).
- `PrivacyContext.tsx`: remove unused `loaded`/`setLoaded` state.

### Removed

- `src/utils/categoryDisplay.ts` (replaced by constant in `constants.ts`).
- Dead `STORAGE_KEYS.FAILED_ATTEMPTS` and `STORAGE_KEYS.LOCKOUT_UNTIL` (never referenced outside `constants.ts`).

## 1.10.0 - 2026-07-05

### Added

- Wallet module: dedicated `WalletCard`, `AddWalletSheet`, `EditWalletSheet`, `ReconcileBalanceSheet`, `WalletOverflowMenu`, and `WalletDetailView` with wallet-level service/types.
- Landing page sections: `FinalCTASection`, `HowItWorksSection`, `PrivacySection`; removed `SocialProofSection`.
- `RevealOnScroll` component and `useNearViewport` hook for viewport-driven animation reveal.
- `PrivacyContext` for global privacy state shared across views.
- `merchantService` consolidating merchant handling.
- `CategoryForm`, `CategoryOverflowMenu`, and `HelpDialog` under `components/categories`.
- E2E flow coverage: new `tests/e2e/flows.spec.ts` covering wallet, category, and payee workflows.
- Lighthouse CI config (`.lighthouserc.json`) wired into CI workflow.

### Changed

- Landing sections (`Hero`, `Features`, `Install`, `TechStack`, `FAQ`) restructured for consistency and reduced copy.
- View layouts rewritten: `HomeView`, `WalletsView`, `DebtsView`, `CategoriesView`, `PayeesView`, `SettingsView`, `StatsView`, `LandingView`.
- `App`, `SidebarNav`, `BottomNav`, onboarding, debt components, summary/transaction cards, settings accordion, and toaster refactored for new shared primitives.
- DB layer (`src/db/db.ts`) and `walletService` consolidated; `payeeService` and `budgetService` adjusted for new shared types.
- Locale files (`en.json`, `id.json`) expanded to cover new UI strings across landing and wallets.
- CI workflow updated to include Lighthouse check.

### Removed

- `SocialProofSection` from landing page.
- Redundant utility code in `formatUtils` and `migration` tests trimmed.

## 1.7.0 - 2026-07-05

### Added

- Sort & filter feature for Recipients & Merchants (Payees) view.
- `PayeeSortSheet` bottom sheet with 10 sort options (Total Spent, Last Date, Count, Average, Name × asc/desc).
- `PayeeFilterSheet` bottom sheet with category, wallet, date range, total spent range, and transaction count range filters.
- `payeeService` refactored to accept `PayeeSortConfig`, `PayeeTransactionFilters`, and `PayeeAggregateFilters` options.
- Transaction-level filters applied before grouping; aggregate filters applied after grouping for correct stats.
- Detail view passes same transaction-level filters for consistency between card stats and history.
- 14 new i18n translation keys for sort/filter UI (English and Indonesian).

## 1.6.0 - 2026-07-05

### Added

- `normalizePayeeKey()` for case-insensitive payee grouping and filtering.
- Unit tests for `payeeService` including normalize, stats, and filter functions.

### Changed

- Moved `MAX_IMPORT_FILE_SIZE` and `downloadBlob` to canonical locations (`constants.ts` and `downloadUtils.ts`).
- Simplified `displayDateFull` to use `Intl.DateTimeFormat` instead of manual month arrays.
- Simplified `toDateKey` to reuse `getTodayStr`.
- Simplified `clickUndoToast` helper by removing unused `messagePattern` parameter.

### Removed

- Deprecated `clearAllStorage`, `readDb`, `getWalletCurrentBalance`, `navigateViaSidebar`, and `importDataViaService` E2E helpers.
- Deprecated `MONTH_NAMES_EN` and `MONTH_NAMES_ID` constants from `constants.ts`.
- Re-exported `MAX_IMPORT_FILE_SIZE` and `downloadBlob` from `importExportService`.

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
