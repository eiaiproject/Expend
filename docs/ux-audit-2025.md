# Expend UX Audit & Implementation Checklist

> Phase 0 deliverable (master.md §12). Repository-driven; verified against source, not assumptions.
> Baseline: lint ✓, typecheck ✓, 284 unit tests ✓, i18n 891 keys ✓, production build ✓ (2025, pre-change).

## Route inventory

| Route | View | Notes |
|---|---|---|
| `/` | HomeView | dense: summary, upcoming, insights, debt card, search, filters, list |
| `/wallets` | WalletsView | |
| `/wallets/:id` | WalletDetailView | |
| `/debts` | DebtsView | |
| `/stats` | StatsView | |
| `/settings` | SettingsView | catch-all: preferences, backup, data, management, security, about |
| `/categories` | CategoriesView | mobile: reachable only via Settings |
| `/payees` | PayeesView | mobile: reachable only via Settings |
| `/schedules` | SchedulesView | mobile: reachable only via Settings |
| `*` | NotFoundView | |

## Navigation (current)

- Mobile bottom nav (5): Home, Wallets, Debts, Stats, Settings + separate floating FAB (56px, bottom-right).
- Desktop sidebar: Home, Wallets, Debts, Payees, Categories, Stats, Settings. **Schedules missing.**
- All routes preserved; deep links work; browser Back works.

## Shared primitives

- `BottomSheetShell` — `<dialog open>` + focus trap, Esc close, body scroll lock. Fixed `h-[85vh]` only. **No backdrop click, no drag handle, no size variants, no footer slot.**
- No shared `PageHeader` — each view hand-rolls its own header/back/actions markup.
- `ConfirmDialog` (provider), `Toaster`, `EmptyState`, `ErrorBoundary`, `Skeleton`, `FilterControls`/`FilterSheet`, `ActionPickerSheet`, `DatePicker`, `CategorySelect`, `WalletSelect`, `OnboardingWizard`, `LockScreen`, `UpdatePrompt`, `InfoPopup`, `DrillDownModal`.
- Focus trap: `useFocusTrap` — saves/restores focus, traps Tab, no focus-visible regression.

## Confirmed issues

1. **Mobile discoverability (P1).** Categories/Payees/Schedules unreachable from bottom nav; buried in Settings §Management. Settings is a feature directory (master.md §3.1/§3.15).
2. **Bottom nav labels 9px** (master.md §3.1 min 11px); prior pass shrank them.
3. **FAB not integrated with nav**; spec prefers central Add (§3.3).
4. **`BottomSheetShell` fixed 85vh, no backdrop click, no footer** → Save hidden behind keyboard on forms (§3.4/§3.7). Uses `vh` not `dvh`.
5. **Page-header size drift**: text-2xl vs text-xl across views (minor).

### Resolved (Phase 1 & 2)

All Phase 1 shared UX contracts are implemented: `PageHeader` primitive (title/description/actions/onBack/backLabel) migrated into all views; `BottomSheetShell` size variants (`content`/`medium`/`full`) + backdrop click-to-close + sticky safe-area footer; form sheets use sticky footers with `form=` association; toolbar/button/empty/error/loading/toast/safe-area patterns standardized by convention.

### Resolved (Phase 3 — core daily workflow)

- **Quick Add default-wallet visibility** (§3.7): collapsed Quick Add now shows a tappable `Wallet: {name}` indicator so the destination wallet is never silently wrong; tapping expands details.
- **Search inputs** (§3.6): `enterKeyHint="search"` on all search fields (Home, Wallets, Debts, Payees, Categories).
- **Action separation** (§3.5): Home header theme/privacy icon buttons gap 4px → 8px.
- Verified already in place: Quick Add progressive disclosure + presets + templates + frequent payees + description suggestions; dirty-guard confirm discard; sticky Save above keyboard; delete undo (single + bulk via `restoreTransactions`); repeat expense/transfer-with-pairs; empty vs. search-empty states with Reset All; active-filter badge; bulk-selection mode; insights ≤3 dismissible; upcoming ≤3 when relevant; toast z-100 above nav.

### Resolved (Phase 4 — financial entities)

- **Wallet detail actions** (§3.9): detail now has the same overflow menu as the list (view txs / edit / transfer / reconcile / archive / delete) plus a prominent Transfer + secondary Edit primary-action row; destructive flows reuse the list-view confirm texts and services; delete navigates back to `/wallets`.
- **Recurring processing feedback** (§3.14): App boot now toasts `N schedules processed` when create-mode processing produced transactions; new `recurring.toastProcessed` i18n key (en + id).
- Verified already in place: archived wallets separated + hidden from transaction selectors; adjust-balance explains the balance-adjustment transaction; safe wallet delete with recovery-path errors; debt segmented All/I owe/Owed to me; payment impact text (`debt.payWalletImpact`); Mark-settled/write-off no-cashflow confirms; schedule cards show frequency/mode/next/status + Pause-over-Delete + Record Now; idempotent processing; categories delete blocked with related-record explanation + Archive offered; payee cards Add-Expense CTA + sort options (recent/frequent/highest/alpha); category color non-color indicator (ring + aria-checked).

### Resolved (Phase 5 — statistics mobile)

- **Chart labels** (§3.11): 10px → 11px minimum everywhere (month bars, line labels, category percentages).
- **Trend chart points tappable**: MiniLineChart gets per-point 28px hit targets (WCAG 2.5.8 AA) + visible dots; tapping opens DrillDownModal (month drill-down for monthly views, day drill-down for week/month/custom-daily).
- **Custom period** (§3.11): a fourth period option with a dedicated DatePicker pair (start/end), auto-clamped start ≤ end; daily trend when range ≤ 61 days, monthly otherwise (capped 48 months).
- **Category ranked rows**: add transaction count `(% · n)` beside amount.
- i18n: `stats.periodCustom` / `stats.customStart` / `stats.customEnd` (en + id).
- E2E: stats tour now exercises custom period + a tappable trend point opening a dialog.
6. **No drag handle / swipe on sheets** (deferred; dirty-guard exists on transaction form).
7. **Android system Back on open sheets** not intercepted (native `<dialog>` not `showModal`) — documented limitation.
8. Sidebar missing Schedules entry (desktop parity).

## Rejected assumptions

- "Stats must stay in bottom nav" → spec Option B: Home, Wallets, Add, Debts, More; Stats moves to More (route + desktop sidebar unchanged).
- "Settings must keep management rows" → removed; More owns feature directory.
- "FAB removal breaks tests" → E2E uses direct routes + role queries; only one ROUTES regex needs disambiguation.

## Financial integrity

No changes to `db/`, `services/`, transfer/debt/recurring logic. Form submit path untouched; only footer placement changes.

## Implemented (this pass)

- **Phase 2 — Navigation**: bottom nav Home/Wallets/Add(central)/Debts/More; `MoreView` at `/more`; Settings slims (Management rows removed); sidebar gains Schedules.
- **Phase 1 — Shell**: `BottomSheetShell` backdrop click, optional `footer` slot, `dvh` height with `vh` fallback.
- **Phase 3 — Form**: TransactionFormSheet sticky Save footer (visible above keyboard).
- Labels ≥10px; nav uses `nav.*` short labels to avoid Indonesian truncation.

## Tests

- `tests/e2e/app.spec.ts`: Settings link regex disambiguated; More route entry added.
- New `tests/unit/moreSections.test.ts`: More groups contain expected routes; label keys exist in en.json + id.json.
- Full gates: lint, typecheck, i18n:check, unit, build, e2e chromium (+ mobile projects where runnable).

## Test results (final)

| Project | Result | Notes |
|---|---|---|
| chromium | 68/68 pass | |
| Mobile Chrome (Pixel 5) | 68/68 pass | |
| Mobile Safari (iPhone 13) | 66/68 | 2 flaky + 1 pre-existing SW offline-reload; no regressions |
| Firefox | 67/68 | 1 flaky (passes isolated) |
| Desktop WebKit | 65/68 | 3 flaky + 1 pre-existing SW offline-reload; no regressions |

Pre-existing failures fixed: insights date bug (day 1–5 of month), FAB/EmptyState ordering in helpers (now targets chrome Add button).

## Deferred

- Sheet size variants (content/medium/full) — single `heightClass` prop exists; per-sheet tuning later.
- Drag handle + swipe-to-dismiss — needs per-sheet dirty assessment; skip until confirmed safe.
- Android Back interception on sheets — convert to `showModal()` pattern in a dedicated pass.
- PageHeader shared primitive — headers already near-uniform (h1 24px); extract when a third inconsistency appears.
- Landing/onboarding/stats mobile redesigns, sheet stacking audit — next phases (master.md Phase 4–7).
- Stats, Categories/Payees/Schedules UX detail work — next phases.
- Overflow menus open downward even when near viewport bottom — would need upward flip logic.
- WebKit/Firefox parallel-flaky tests — investigate test isolation (not in scope).
- `docs/screenshots/` mobile captures require DB seed — script update deferred.
