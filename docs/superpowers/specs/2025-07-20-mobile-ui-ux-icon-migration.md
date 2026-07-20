# Mobile UI/UX Audit & Icon Migration to Reicon

**Date:** 2025-07-20  
**Project:** Expend — Local-first PWA expense tracker  
**Status:** Approved design  

## 1. Overview

Migrate all icons from `lucide-react` to `reicon-react` (https://reicon.dev) across the entire Expend codebase, while simultaneously auditing and improving the mobile UI/UX experience. Two workstreams in a single pass: (A) icon replacement, (B) targeted mobile UX fixes.

## 2. Workstream A — Icon Migration

### 2.1 Dependency Change

| Current | Replacement |
|---------|-------------|
| `lucide-react@^0.546.0` | `reicon-react@^latest` (MIT, tree-shakeable, 0 runtime deps) |

Install: `npm install reicon-react && npm uninstall lucide-react`

### 2.2 Icon Mapping (Complete)

Every `lucide-react` import has a verified 1:1 mapping to `reicon-react`:

| lucide‑react | reicon‑react | Notes |
|---|---|---|
| `AlertTriangle` | `AlertTriangle` | Direct |
| `ArrowDown` | `ArrowDown` | Direct |
| `ArrowDownCircle` | `ArrowDownCircle` | Direct |
| `ArrowDownLeft` | `ArrowDownLeft` | Direct |
| `ArrowDownRight` | `ArrowDownRight` | Direct |
| `ArrowLeft` | `ArrowLeft` | Direct |
| `ArrowLeftRight` | `TransferH` | Horizontal transfer arrows |
| `ArrowRight` | `ArrowRight` | Direct |
| `ArrowRightLeft` | `ArrowSwapHorizontal` | Horizontal swap arrows |
| `ArrowUp` | `ArrowUp` | Direct |
| `ArrowUpDown` | `SortV` | Vertical sort arrows |
| `ArrowUpRight` | `ArrowUpRight` | Direct |
| `Archive` | `Archive` | Direct |
| `ArchiveRestore` | `ArchiveTick` | Restore as tick variant |
| `Ban` | `Ban` | Direct |
| `BarChart3` | `ChartBar` | Bar chart |
| `Calendar` | `Calendar` | Direct |
| `Check` | `Check` | Direct |
| `CheckCircle2` | `CheckCircle` | Direct |
| `ChevronDown` | `ChevronDown` | Direct |
| `ChevronUp` | `ChevronUp` | Direct |
| `ClipboardCheck` | `ClipboardCheck` | Direct |
| `ClipboardList` | `ClipboardList` | Direct |
| `Clock` | `Clock` | Direct |
| `Coffee` | `Coffee` | Direct |
| `Code2` | `Code2` | Direct |
| `Database` | `Database` | Direct |
| `DollarSign` | `DollarSign` | Direct |
| `Download` | `Download` | Direct |
| `Edit2` | `Edit2` | Direct |
| `Eye` | `Eye` | Direct |
| `EyeOff` | `EyeOff` | Direct |
| `Filter` | `Filter` | Direct |
| `Globe` | `Globe` | Direct |
| `HandCoins` | `HandDollar` | Hand with dollar |
| `Handshake` | `Handshake` | Direct |
| `HelpCircle` | `HelpCircle` | Direct |
| `Home` | `Home` | Direct |
| `Info` | `Information` | or `InfoCircle` |
| `Keyboard` | `Keyboard` | Direct |
| `Lock` | `Lock` | Direct |
| `Moon` | `Moon` | Direct |
| `MoreHorizontal` | `MoreH` | Horizontal dots |
| `MoreVertical` | `More` | Vertical dots (More is vertical) |
| `Pencil` | `Edit` | Edit pencil icon |
| `PieChart` | `ChartPie` | Pie chart |
| `Plus` | `Plus` | Direct |
| `RefreshCw` | `Refresh` | Direct |
| `Repeat` | `Repeat` | Direct |
| `Save` | `Save` | Direct |
| `Scale` | `Scale` | Direct |
| `Search` | `Search` | Direct |
| `Settings` | `Settings` | Direct |
| `Shield` | `Shield` | Direct |
| `ShieldAlert` | `ShieldAlert` | Direct |
| `ShieldCheck` | `ShieldCheck` | Direct |
| `ShoppingBag` | `ShoppingBag` | Direct |
| `Smartphone` | `Mobile` | Phone icon |
| `Sparkles` | `Stars2` | Stars/sparkles |
| `Sun` | `Sun` | Direct |
| `Tag` | `Tag` | Direct |
| `Tags` | `Tags` | Direct |
| `Trash2` | `Trash` | Direct |
| `TrendingUp` | `TrendUp` | Up trend |
| `TrendingDown` | `TrendDown` | Down trend |
| `Wallet` | `Wallet` | Direct |
| `Wifi` | `Wifi` | Direct |
| `WifiOff` | `WifiOff` | Direct |
| `X` | `X` | Direct |
| `XCircle` | `XCircle` | Direct |
| `Zap` | `Bolt` | Lightning bolt |

### 2.3 Files to Modify (~40 files)

All files that import from `lucide-react`:

**Views (8):** `App.tsx`, `HomeView.tsx`, `WalletsView.tsx`, `DebtsView.tsx`, `StatsView.tsx`, `SettingsView.tsx`, `CategoriesView.tsx`, `PayeesView.tsx`, `LandingView.tsx`

**Components (30+):** `BottomNav.tsx`, `SidebarNav.tsx`, `TransactionDetailSheet.tsx`, `TransactionFormSheet.tsx`, `TransactionCard.tsx`, `SummaryCard.tsx`, `DebtCard.tsx`, `DebtDetailSheet.tsx`, `DebtFormSheet.tsx`, `DebtPaymentSheet.tsx`, `WalletCard.tsx`, `WalletOverflowMenu.tsx`, `AddWalletSheet.tsx`, `EditWalletSheet.tsx`, `ReconcileBalanceSheet.tsx`, `ActionPickerSheet.tsx`, `FilterSheet.tsx`, `PayeeFilterSheet.tsx`, `PayeeSortSheet.tsx`, `CategorySelect.tsx`, `CategoryForm.tsx`, `CategoryOverflowMenu.tsx`, `HelpDialog.tsx`, `WalletSelect.tsx`, `DatePicker.tsx`, `FilterControls.tsx`, `LockScreen.tsx`, `PinSetupModal.tsx`, `VerifyCurrentPinModal.tsx`, `SettingsAccordion.tsx`, `OnboardingWizard.tsx`, `InfoPopup.tsx`, `UpdatePrompt.tsx`, `EmptyState.tsx`, `ActiveFilterChips.tsx`, `DrillDownModal.tsx`, `ConfirmDialog.tsx`, `BottomSheetShell.tsx`

**Landing views (8):** `HeroSection.tsx`, `FeaturesSection.tsx`, `HowItWorksSection.tsx`, `PreviewSection.tsx`, `InstallSection.tsx`, `PrivacySection.tsx`, `FAQSection.tsx`, `TechStackSection.tsx`, `FinalCTASection.tsx`

### 2.4 Icon Size & Props Compatibility

`reicon-react` uses the same prop interface as `lucide-react`:
- `size` (number) — both libraries
- `color` (string, default `currentColor`) — both
- `className` (string) — both
- `strokeWidth` (number, override) — reicon also has `weight` prop

Migration is a mechanical import swap. No visual changes expected since both use 24×24 grid icons.

## 3. Workstream B — Mobile UI/UX Audit & Fixes

### 3.1 Issues Found

| # | Issue | Location | Severity | Fix |
|---|---|---|---|---|
| 1 | BottomNav items crowded on <360px screens, labels may truncate | `BottomNav.tsx` | Medium | Reduce gap, use `text-[9px]` or allow horizontal scroll on very small screens |
| 2 | No drag-to-dismiss on bottom sheets | All `*Sheet.tsx` components | Medium | Add `touchmove` handler for pull-down dismiss via `BottomSheetShell.tsx` |
| 3 | TransactionCard action buttons (edit/delete/view) clustered close together | `TransactionCard.tsx` | Low-Medium | Increase tap target spacing, use `gap-2` minimum |
| 4 | FAB zone may overlap with system nav bar on some devices | `App.tsx` / `BottomNav.tsx` | Low | Verify `padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 16px)` covers all cases |
| 5 | FilterSheet lacks visual scroll indicator when filters overflow | `FilterSheet.tsx` | Low | Add subtle gradient fade at bottom edge |
| 6 | Search bar on HomeView could use autofocus on mobile search gesture | `HomeView.tsx` | Low | Add `enterKeyHint="search"` and consider auto-focus when filter is opened |
| 7 | Skeleton loading states flash on fast connections | `Skeleton.tsx` | Low | Add `prefers-reduced-data` or minimum display time |
| 8 | Some views (Stats, Debts) have horizontal scroll that could be smoother | `StatsView.tsx`, `DebtsView.tsx` | Low | Use `scroll-snap-type` for chip rows |
| 9 | Active filter count badge overlaps with filter button | `HomeView.tsx` | Medium | Reposition badge or increase button size slightly |
| 10 | Summary card on HomeView could be more compact on mobile | `SummaryCard.tsx` | Low | Review padding at <400px viewport |

### 3.2 Priority Order for Fixes

1. **P1 — Tap target safety**: TransactionCard button spacing (issue 3)
2. **P1 — Navigation crowding**: BottomNav on small screens (issue 1)
3. **P2 — Sheet UX**: Drag-to-dismiss on bottom sheets (issue 2)
4. **P2 — Filter usability**: Badge overlap fix + scroll indicator (issues 5, 9)
5. **P3 — Polish**: Search enhancement, skeleton timing, horizontal scroll, FAB zone (issues 4, 6, 7, 8, 10)

## 4. Execution Plan

### Phase 1: Icon Migration
1. Install `reicon-react`, uninstall `lucide-react`
2. Update all imports in every file (batch edit by file)
3. Remove all `lucide-react` references

### Phase 2: Mobile UX Fixes
1. BottomNav — responsive sizing
2. TransactionCard — button spacing
3. BottomSheetShell — drag-to-dismiss
4. FilterSheet — scroll indicator
5. Filter badge positioning
6. Remaining polish items

### Phase 3: Verification
1. `npm run typecheck` — no type errors
2. `npm run build` — successful build
3. Manual mobile viewport testing (375px, 390px, 414px)
4. `npm run test:unit` — all tests pass

## 5. Success Criteria

- Zero remaining imports from `lucide-react`
- All icons render correctly with reicon-react
- No regressions in mobile layout or interaction
- P1 mobile UX issues resolved
- TypeScript compiles without errors
- All unit tests pass
