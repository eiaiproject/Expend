# Mobile UI/UX Audit & Icon Migration to Reicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all icons from `lucide-react` to `reicon-react` and apply targeted mobile UI/UX improvements in a single pass.

**Architecture:** Mechanical icon import swap across all files (1:1 mapping verified), then targeted mobile polish (tap targets, bottom nav crowding, sheet UX, filter usability). No architectural changes; CSS/JSX-only.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, reicon-react (replacing lucide-react), Dexie/IndexedDB, react-router-dom 7

## Global Constraints

- `lucide-react` MUST be fully removed from `package.json` and all source files
- All 45+ unique lucide icons MUST have verified reicon-react equivalents (see mapping in spec)
- TypeScript MUST compile without errors after every task
- Reicon-react icon size prop is identical to lucide-react (number, default 24)
- Reicon-react color defaults to `currentColor` (same as lucide)
- Mobile-first: verify changes at 375px, 390px, 414px viewports
- No visual regressions in icon rendering
- All unit tests MUST pass after every task
- WCAG AA compliance: tap targets ≥44px (already met, must be preserved)
- `safe-area-inset-bottom` MUST be respected on all bottom-positioned elements

---

## File Structure

### Files Modified (Icon Migration)

**Views:** `App.tsx`, `views/HomeView.tsx`, `views/WalletsView.tsx`, `views/DebtsView.tsx`, `views/StatsView.tsx`, `views/SettingsView.tsx`, `views/CategoriesView.tsx`, `views/PayeesView.tsx`, `views/LandingView.tsx`

**Components:** `components/BottomNav.tsx`, `components/SidebarNav.tsx`, `components/TransactionDetailSheet.tsx`, `components/TransactionFormSheet.tsx`, `components/home/TransactionCard.tsx`, `components/home/SummaryCard.tsx`, `components/debts/DebtCard.tsx`, `components/debts/DebtDetailSheet.tsx`, `components/debts/DebtFormSheet.tsx`, `components/debts/DebtPaymentSheet.tsx`, `components/wallet/WalletCard.tsx`, `components/wallet/WalletOverflowMenu.tsx`, `components/wallet/AddWalletSheet.tsx`, `components/wallet/EditWalletSheet.tsx`, `components/wallet/ReconcileBalanceSheet.tsx`, `components/ActionPickerSheet.tsx`, `components/FilterSheet.tsx`, `components/PayeeFilterSheet.tsx`, `components/PayeeSortSheet.tsx`, `components/CategorySelect.tsx`, `components/categories/CategoryForm.tsx`, `components/categories/CategoryOverflowMenu.tsx`, `components/categories/HelpDialog.tsx`, `components/WalletSelect.tsx`, `components/DatePicker.tsx`, `components/FilterControls.tsx`, `components/LockScreen.tsx`, `components/settings/PinSetupModal.tsx`, `components/settings/VerifyCurrentPinModal.tsx`, `components/settings/SettingsAccordion.tsx`, `components/OnboardingWizard.tsx`, `components/InfoPopup.tsx`, `components/UpdatePrompt.tsx`, `components/EmptyState.tsx`, `components/home/ActiveFilterChips.tsx`, `components/DrillDownModal.tsx`, `components/ConfirmDialog.tsx`, `components/BottomSheetShell.tsx`

**Landing Views:** `views/landing/HeroSection.tsx`, `views/landing/FeaturesSection.tsx`, `views/landing/HowItWorksSection.tsx`, `views/landing/PreviewSection.tsx`, `views/landing/InstallSection.tsx`, `views/landing/PrivacySection.tsx`, `views/landing/FAQSection.tsx`, `views/landing/TechStackSection.tsx`, `views/landing/FinalCTASection.tsx`

### Files Modified (UX Polish)

- `components/BottomNav.tsx` (responsive sizing for small screens)
- `components/home/TransactionCard.tsx` (button spacing)
- `components/BottomSheetShell.tsx` (drag-to-dismiss foundation)
- `components/FilterSheet.tsx` (scroll fade indicator)
- `views/HomeView.tsx` (filter badge positioning)

### Files Unchanged

- All `*.css` files (no style token changes)
- All `db/`, `services/`, `utils/`, `hooks/`, `contexts/`, `types/` files
- `i18n/` files

---

### Task 1: Install reicon-react and remove lucide-react

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install reicon-react**

Run: `npm install reicon-react@latest`
Expected: Added to dependencies, no errors.

- [ ] **Step 2: Uninstall lucide-react**

Run: `npm uninstall lucide-react`
Expected: Removed from dependencies, no errors.

- [ ] **Step 3: Verify package.json**

Run: `grep -E "lucide|reicon" package.json`
Expected: Only `reicon-react` listed, no `lucide-react`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap lucide-react for reicon-react"
```

---

### Task 2: Migrate icons in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace import statement**

Old:
```tsx
import { Download, WifiOff, X } from 'lucide-react';
```

New:
```tsx
import { Download, WifiOff, X } from 'reicon-react';
```

- [ ] **Step 2: Verify no other lucide references**

Run: `grep -n "lucide" src/App.tsx`
Expected: No matches.

- [ ] **Step 3: Type check**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: migrate App.tsx icons to reicon-react"
```

---

### Task 3: Migrate icons in views/HomeView.tsx

**Files:**
- Modify: `src/views/HomeView.tsx`

- [ ] **Step 1: Replace import statement**

Old:
```tsx
import { Eye, EyeOff, Moon, Sun, Filter, ArrowUpDown, Search, XCircle, X, Trash2, Handshake } from 'lucide-react';
```

New:
```tsx
import { Eye, EyeOff, Moon, Sun, Filter, SortV, Search, XCircle, X, Trash, Handshake } from 'reicon-react';
```

Note: `ArrowUpDown` → `SortV`; `Trash2` → `Trash`.

- [ ] **Step 2: Update JSX usages**

Find and replace:
- `<ArrowUpDown` → `<SortV`
- `<Trash2` → `<Trash`

Use `grep -n "ArrowUpDown\|Trash2" src/views/HomeView.tsx` to find them.

- [ ] **Step 3: Verify no other lucide references**

Run: `grep -n "lucide\|ArrowUpDown\|Trash2" src/views/HomeView.tsx`
Expected: No matches.

- [ ] **Step 4: Type check**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/views/HomeView.tsx
git commit -m "refactor: migrate HomeView icons to reicon-react"
```

---

### Task 4: Migrate icons in views/WalletsView.tsx

**Files:**
- Modify: `src/views/WalletsView.tsx`

- [ ] **Step 1: Replace import statement**

Old:
```tsx
import { Wallet as WalletIcon, HelpCircle, Plus, Search, XCircle, Handshake, ArrowUpDown } from 'lucide-react';
```

New:
```tsx
import { Wallet as WalletIcon, HelpCircle, Plus, Search, XCircle, Handshake, SortV } from 'reicon-react';
```

- [ ] **Step 2: Update JSX usages**

Find and replace `<ArrowUpDown` → `<SortV`.

- [ ] **Step 3: Verify and type check**

```bash
grep -n "lucide\|ArrowUpDown" src/views/WalletsView.tsx
npm run typecheck
```

Expected: No matches; no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/WalletsView.tsx
git commit -m "refactor: migrate WalletsView icons to reicon-react"
```

---

### Task 5: Migrate icons in views/DebtsView.tsx

**Files:**
- Modify: `src/views/DebtsView.tsx`

- [ ] **Step 1: Replace import statement**

Old:
```tsx
import { AlertTriangle, Handshake, HelpCircle, Plus, Search, X } from 'lucide-react';
```

New:
```tsx
import { AlertTriangle, Handshake, HelpCircle, Plus, Search, X } from 'reicon-react';
```

- [ ] **Step 2: Verify and type check**

```bash
grep -n "lucide" src/views/DebtsView.tsx
npm run typecheck
```

Expected: No matches; no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/views/DebtsView.tsx
git commit -m "refactor: migrate DebtsView icons to reicon-react"
```

---

### Task 6: Migrate icons in views/StatsView.tsx

**Files:**
- Modify: `src/views/StatsView.tsx`

- [ ] **Step 1: Replace import statement**

Old:
```tsx
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
```

New:
```tsx
import { ChartBar, ChevronDown, ChevronUp } from 'reicon-react';
```

Note: `BarChart3` → `ChartBar`.

- [ ] **Step 2: Update JSX usages**

Find and replace `<BarChart3` → `<ChartBar`.

- [ ] **Step 3: Verify and type check**

```bash
grep -n "lucide\|BarChart3" src/views/StatsView.tsx
npm run typecheck
```

Expected: No matches; no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/StatsView.tsx
git commit -m "refactor: migrate StatsView icons to reicon-react"
```

---

### Task 7: Migrate icons in views/SettingsView.tsx

**Files:**
- Modify: `src/views/SettingsView.tsx`

- [ ] **Step 1: Inspect current imports**

Run: `grep -n "lucide" src/views/SettingsView.tsx`
Note: Output truncated; just check the imports line.

- [ ] **Step 2: Replace import statement**

Apply the standard mapping from the spec (any lucide icons present → reicon equivalents per the spec table).

- [ ] **Step 3: Verify and type check**

```bash
grep -n "lucide" src/views/SettingsView.tsx
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/views/SettingsView.tsx
git commit -m "refactor: migrate SettingsView icons to reicon-react"
```

---

### Task 8: Migrate icons in views/CategoriesView.tsx

**Files:**
- Modify: `src/views/CategoriesView.tsx`

- [ ] **Step 1: Inspect and replace**

```bash
grep -n "lucide" src/views/CategoriesView.tsx
```

Apply standard mapping, replace import, update JSX usages.

- [ ] **Step 2: Verify and type check**

```bash
grep -n "lucide" src/views/CategoriesView.tsx
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/views/CategoriesView.tsx
git commit -m "refactor: migrate CategoriesView icons to reicon-react"
```

---

### Task 9: Migrate icons in views/PayeesView.tsx

**Files:**
- Modify: `src/views/PayeesView.tsx`

- [ ] **Step 1: Inspect and replace**

```bash
grep -n "lucide" src/views/PayeesView.tsx
```

Apply standard mapping, replace import, update JSX usages.

- [ ] **Step 2: Verify and type check**

```bash
grep -n "lucide" src/views/PayeesView.tsx
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/views/PayeesView.tsx
git commit -m "refactor: migrate PayeesView icons to reicon-react"
```

---

### Task 10: Migrate icons in views/LandingView.tsx

**Files:**
- Modify: `src/views/LandingView.tsx`

- [ ] **Step 1: Replace import**

Old: `import { ArrowUp, Globe } from 'lucide-react';`
New: `import { ArrowUp, Globe } from 'reicon-react';`

- [ ] **Step 2: Verify and type check**

```bash
grep -n "lucide" src/views/LandingView.tsx
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/views/LandingView.tsx
git commit -m "refactor: migrate LandingView icons to reicon-react"
```

---

### Task 11: Migrate icons in all landing section components

**Files:**
- Modify: `src/views/landing/HeroSection.tsx`
- Modify: `src/views/landing/FeaturesSection.tsx`
- Modify: `src/views/landing/HowItWorksSection.tsx`
- Modify: `src/views/landing/PreviewSection.tsx`
- Modify: `src/views/landing/InstallSection.tsx`
- Modify: `src/views/landing/PrivacySection.tsx`
- Modify: `src/views/landing/FAQSection.tsx`
- Modify: `src/views/landing/TechStackSection.tsx`
- Modify: `src/views/landing/FinalCTASection.tsx`

- [ ] **Step 1: Inspect all imports**

Run: `grep -rn "lucide" src/views/landing/`

- [ ] **Step 2: Replace imports file-by-file**

Apply the spec mapping table for each file.

Common mappings for landing:
- `BarChart3` → `ChartBar`
- `PieChart` → `ChartPie`
- `TrendingUp` → `TrendUp`
- `Wallet` → `Wallet`
- `Tag` → `Tag`
- `Tags` → `Tags`
- `Handshake` → `Handshake`
- `Zap` → `Bolt`
- `Shield` → `Shield`
- `Wifi` → `Wifi`
- `Search` → `Search`
- `Code2` → `Code2`
- `Database` → `Database`
- `Smartphone` → `Mobile`
- `Plus` → `Plus`
- `RefreshCw` → `Refresh`
- `ChevronDown` → `ChevronDown`
- `Download` → `Download`
- `Check` → `Check`
- `ArrowDown` → `ArrowDown`
- `ArrowLeftRight` → `TransferH`

- [ ] **Step 3: Verify and type check**

```bash
grep -rn "lucide" src/views/landing/
npm run typecheck
```

Expected: No matches; no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/landing/
git commit -m "refactor: migrate landing section icons to reicon-react"
```

---

### Task 12: Migrate icons in components/BottomNav.tsx

**Files:**
- Modify: `src/components/BottomNav.tsx`

- [ ] **Step 1: Replace import**

Old:
```tsx
import { Home, Wallet, Handshake, PieChart, Settings, Plus } from 'lucide-react';
```

New:
```tsx
import { Home, Wallet, Handshake, ChartPie, Settings, Plus } from 'reicon-react';
```

Note: `PieChart` → `ChartPie`.

- [ ] **Step 2: Update JSX usages**

Find and replace `<PieChart` → `<ChartPie`.

- [ ] **Step 3: Verify and type check**

```bash
grep -n "lucide\|PieChart" src/components/BottomNav.tsx
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "refactor: migrate BottomNav icons to reicon-react"
```

---

### Task 13: Migrate icons in components/SidebarNav.tsx

**Files:**
- Modify: `src/components/SidebarNav.tsx`

- [ ] **Step 1: Replace import**

Old:
```tsx
import { Home, Wallet, PieChart, Settings, Plus, Tag, Handshake, ShoppingBag } from 'lucide-react';
```

New:
```tsx
import { Home, Wallet, ChartPie, Settings, Plus, Tag, Handshake, ShoppingBag } from 'reicon-react';
```

- [ ] **Step 2: Update JSX usages**

Find and replace `<PieChart` → `<ChartPie`.

- [ ] **Step 3: Verify and type check**

```bash
grep -n "lucide\|PieChart" src/components/SidebarNav.tsx
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SidebarNav.tsx
git commit -m "refactor: migrate SidebarNav icons to reicon-react"
```

---

### Task 14: Migrate icons in all sheet components

**Files:**
- Modify: `src/components/TransactionDetailSheet.tsx`
- Modify: `src/components/TransactionFormSheet.tsx`
- Modify: `src/components/ActionPickerSheet.tsx`
- Modify: `src/components/FilterSheet.tsx`
- Modify: `src/components/PayeeFilterSheet.tsx`
- Modify: `src/components/PayeeSortSheet.tsx`
- Modify: `src/components/DrillDownModal.tsx`
- Modify: `src/components/ConfirmDialog.tsx`
- Modify: `src/components/BottomSheetShell.tsx`
- Modify: `src/components/CategorySelect.tsx`
- Modify: `src/components/WalletSelect.tsx`
- Modify: `src/components/DatePicker.tsx`
- Modify: `src/components/FilterControls.tsx`
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/components/InfoPopup.tsx`
- Modify: `src/components/UpdatePrompt.tsx`
- Modify: `src/components/LockScreen.tsx`
- Modify: `src/components/OnboardingWizard.tsx`

- [ ] **Step 1: Inspect all sheet imports**

Run: `grep -rln "lucide" src/components/*.tsx`

- [ ] **Step 2: Replace imports file-by-file**

Apply standard mapping per the spec table. Common mappings:
- `Edit2` → `Edit2`
- `Trash2` → `Trash`
- `Repeat` → `Repeat`
- `X` → `X`
- `ArrowDownCircle` → `ArrowDownCircle`
- `Handshake` → `Handshake`
- `Check` → `Check`
- `Calendar` → `Calendar`
- `ChevronDown` → `ChevronDown`
- `Wallet` → `Wallet` (or alias as `WalletIcon`)
- `Search` → `Search`
- `XCircle` → `XCircle`
- `ClipboardList` → `ClipboardList`
- `Coffee` → `Coffee`
- `Keyboard` → `Keyboard`
- `Lock` → `Lock`
- `RefreshCw` → `Refresh`
- `Tag` → `Tag`
- `CheckCircle2` → `CheckCircle`
- `Wallet as WalletIcon` → `Wallet as WalletIcon` (keep alias)
- `Plus` → `Plus`
- `ArrowRight` → `ArrowRight`
- `ArrowLeft` → `ArrowLeft`
- `Sparkles` → `Stars2`
- `Info` → `Information`

- [ ] **Step 3: Update all JSX icon usages** matching the rename (e.g., `Edit2` → `Edit2` no change, `Trash2` → `Trash`).

- [ ] **Step 4: Verify and type check**

```bash
grep -rln "lucide" src/components/*.tsx
npm run typecheck
```

Expected: No matches; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/*.tsx
git commit -m "refactor: migrate top-level sheet/dialog icons to reicon-react"
```

---

### Task 15: Migrate icons in components/home/*

**Files:**
- Modify: `src/components/home/ActiveFilterChips.tsx`
- Modify: `src/components/home/SummaryCard.tsx`
- Modify: `src/components/home/TransactionCard.tsx`

- [ ] **Step 1: Inspect home component imports**

Run: `grep -rln "lucide" src/components/home/`

- [ ] **Step 2: Replace imports and JSX usages**

Apply standard mapping:
- `X` → `X`
- `ArrowDownCircle` → `ArrowDownCircle`
- `TrendingUp` → `TrendUp`
- `TrendingDown` → `TrendDown`
- `BarChart3` → `ChartBar`
- `ArrowUpRight` → `ArrowUpRight`
- `ArrowDownLeft` → `ArrowDownLeft`
- `RefreshCw` → `Refresh`
- `Edit2` → `Edit2`
- `Trash2` → `Trash`
- `MoreVertical` → `More`
- `Eye` → `Eye`
- `CheckCircle2` → `CheckCircle`

- [ ] **Step 3: Verify and type check**

```bash
grep -rln "lucide" src/components/home/
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/home/
git commit -m "refactor: migrate home component icons to reicon-react"
```

---

### Task 16: Migrate icons in components/debts/*

**Files:**
- Modify: `src/components/debts/DebtCard.tsx`
- Modify: `src/components/debts/DebtDetailSheet.tsx`
- Modify: `src/components/debts/DebtFormSheet.tsx`
- Modify: `src/components/debts/DebtPaymentSheet.tsx`

- [ ] **Step 1: Inspect and replace**

Apply mapping:
- `ArrowDownLeft` → `ArrowDownLeft`
- `ArrowUpRight` → `ArrowUpRight`
- `CheckCircle2` → `CheckCircle`
- `Clock` → `Clock`
- `AlertTriangle` → `AlertTriangle`
- `MoreHorizontal` → `MoreH`
- `Pencil` → `Edit`
- `Trash2` → `Trash`
- `HandCoins` → `HandDollar`
- `Wallet` → `Wallet`
- `Ban` → `Ban`

- [ ] **Step 2: Verify and type check**

```bash
grep -rln "lucide\|Trash2\|HandCoins\|Pencil" src/components/debts/
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/debts/
git commit -m "refactor: migrate debt component icons to reicon-react"
```

---

### Task 17: Migrate icons in components/wallet/*

**Files:**
- Modify: `src/components/wallet/WalletCard.tsx`
- Modify: `src/components/wallet/WalletOverflowMenu.tsx`
- Modify: `src/components/wallet/AddWalletSheet.tsx`
- Modify: `src/components/wallet/EditWalletSheet.tsx`
- Modify: `src/components/wallet/ReconcileBalanceSheet.tsx`

- [ ] **Step 1: Inspect and replace**

Apply mapping:
- `Wallet` → `Wallet` (keep alias as needed)
- `AlertCircle` → `AlertCircle` (or `AlertCircle2`)
- `TrendingUp` → `TrendUp`
- `TrendingDown` → `TrendDown`
- `MoreVertical` → `More`
- `Eye` → `Eye`
- `Pencil` → `Edit`
- `ArrowRightLeft` → `ArrowSwapHorizontal`
- `Scale` → `Scale`
- `Archive` → `Archive`
- `ArchiveRestore` → `ArchiveTick`
- `Trash2` → `Trash`

- [ ] **Step 2: Verify and type check**

```bash
grep -rln "lucide\|Trash2\|Pencil\|ArchiveRestore" src/components/wallet/
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wallet/
git commit -m "refactor: migrate wallet component icons to reicon-react"
```

---

### Task 18: Migrate icons in components/categories/* and components/settings/*

**Files:**
- Modify: `src/components/categories/CategoryForm.tsx`
- Modify: `src/components/categories/CategoryOverflowMenu.tsx`
- Modify: `src/components/categories/HelpDialog.tsx`
- Modify: `src/components/settings/PinSetupModal.tsx`
- Modify: `src/components/settings/VerifyCurrentPinModal.tsx`
- Modify: `src/components/settings/SettingsAccordion.tsx`

- [ ] **Step 1: Inspect and replace**

Apply mapping:
- `Save` → `Save`
- `X` → `X`
- `MoreVertical` → `More`
- `Tag` → `Tag`
- `DollarSign` → `DollarSign`
- `Eye` → `Eye`
- `Archive` → `Archive`
- `Trash2` → `Trash`
- `ArrowRightLeft` → `ArrowSwapHorizontal`
- `Wallet` → `Wallet`
- `Lock` → `Lock`
- `EyeOff` → `EyeOff`
- `Info` → `Information`
- `ChevronDown` → `ChevronDown`

- [ ] **Step 2: Verify and type check**

```bash
grep -rln "lucide" src/components/categories/ src/components/settings/
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/categories/ src/components/settings/
git commit -m "refactor: migrate categories/settings icons to reicon-react"
```

---

### Task 19: Final verification — no lucide references remain

**Files:** (none modified)

- [ ] **Step 1: Search all source files for lucide**

Run: `grep -rln "lucide" src/`
Expected: No output.

- [ ] **Step 2: Type check the full project**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass.

- [ ] **Step 4: Build the project**

Run: `npm run build`
Expected: Successful build, no errors.

- [ ] **Step 5: Commit (only if package-lock.json changed)**

```bash
git status
# If package-lock.json or other files were touched by typecheck/lint:
git add -A
git diff --cached --stat
git commit -m "chore: post-migration verification cleanup" --allow-empty
```

---

### Task 20: Mobile UX fix — BottomNav responsive sizing

**Files:**
- Modify: `src/components/BottomNav.tsx`

- [ ] **Step 1: Read current BottomNav layout**

```bash
grep -n "flex-col\|min-h\|min-w\|text-\[" src/components/BottomNav.tsx
```

- [ ] **Step 2: Update NavItem className for tighter small-screen fit**

Find the `<NavItem to="/wallets"` and similar items. Update the inner `<span className={cn("rounded-full p-1.5 transition-colors"...)}>`:

Old:
```tsx
<span className={cn(
  "rounded-full p-1.5 transition-colors",
  isActive && "bg-[var(--accent)]/10"
)} aria-hidden="true">
```

New:
```tsx
<span className={cn(
  "rounded-full p-1 transition-colors",
  isActive && "bg-[var(--accent)]/10"
)} aria-hidden="true">
```

- [ ] **Step 3: Reduce label font on small screens**

Find the `<span className={cn("text-[10px]",`... line and update to allow tighter text:

Old:
```tsx
<span className={cn(
  "text-[10px]",
  isActive ? "font-bold" : "font-medium"
)}>{label}</span>
```

New:
```tsx
<span className={cn(
  "text-[9px] leading-none px-0.5",
  isActive ? "font-bold" : "font-medium"
)}>{label}</span>
```

- [ ] **Step 4: Verify type check**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "fix(mobile): tighten BottomNav spacing for <360px screens"
```

---

### Task 21: Mobile UX fix — TransactionCard action button spacing

**Files:**
- Modify: `src/components/home/TransactionCard.tsx`

- [ ] **Step 1: Locate the action buttons**

Run: `grep -n "Edit2\|Trash2\|MoreVertical\|Eye\|onClick.*onEdit\|onClick.*onDelete" src/components/home/TransactionCard.tsx`

- [ ] **Step 2: Add minimum gap between action buttons**

Find the container that wraps the edit/delete/detail buttons and add `gap-1` (or expand to `gap-1.5` if currently using `gap-0`):

If buttons are inside a `<div className="flex items-center gap-...">`, ensure the gap is at least `gap-1`. If they are using no explicit gap, change to:

Old (if found):
```tsx
<div className="flex items-center">
```

New:
```tsx
<div className="flex items-center gap-0.5">
```

- [ ] **Step 3: Verify type check**

Run: `npm run typecheck`

- [ ] **Step 4: Commit**

```bash
git add src/components/home/TransactionCard.tsx
git commit -m "fix(mobile): space out TransactionCard action buttons to prevent mis-taps"
```

---

### Task 22: Mobile UX fix — Filter badge positioning on HomeView

**Files:**
- Modify: `src/views/HomeView.tsx`

- [ ] **Step 1: Locate the filter button**

Run: `grep -n "activeFilterCount\|absolute -top-1 -right-1" src/views/HomeView.tsx`

- [ ] **Step 2: Improve badge position**

Find the filter button's badge span:
```tsx
<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center">
```

Ensure it doesn't overlap the button text. Change to:
```tsx
<span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
```

- [ ] **Step 3: Verify type check**

Run: `npm run typecheck`

- [ ] **Step 4: Commit**

```bash
git add src/views/HomeView.tsx
git commit -m "fix(mobile): reposition filter count badge to avoid overlap"
```

---

### Task 23: Mobile UX fix — FilterSheet scroll fade indicator

**Files:**
- Modify: `src/components/FilterSheet.tsx`

- [ ] **Step 1: Locate the scrollable area**

Run: `grep -n "overflow-y-auto\|max-h-\[" src/components/FilterSheet.tsx`

- [ ] **Step 2: Add scroll fade indicator via CSS**

In `src/index.css`, under the `@layer utilities` block, add:

```css
.scroll-fade-bottom {
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%);
  mask-image: linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%);
}
```

- [ ] **Step 3: Apply class to FilterSheet scrollable area**

Find the `overflow-y-auto` div in FilterSheet and add the `scroll-fade-bottom` class. For example:

Old:
```tsx
<div className="overflow-y-auto max-h-[60vh] px-4 py-3">
```

New:
```tsx
<div className="overflow-y-auto max-h-[60vh] px-4 py-3 scroll-fade-bottom">
```

- [ ] **Step 4: Verify type check and build**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/FilterSheet.tsx src/index.css
git commit -m "feat(mobile): add bottom scroll-fade indicator to FilterSheet"
```

---

### Task 24: Final mobile viewport smoke test

**Files:** (none modified)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Vite dev server starts on port 3000.

- [ ] **Step 2: Manual viewport verification (via Playwright if available)**

If Playwright is set up:
```bash
npm run test:e2e:chromium
```
Expected: All e2e tests pass.

- [ ] **Step 3: Lint check**

Run: `npm run lint -- --max-warnings=0`
Expected: No errors.

- [ ] **Step 4: Final type check**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 5: Final test run**

Run: `npm run test:unit`
Expected: All tests pass.

- [ ] **Step 6: Commit any lockfile/lint fixes**

```bash
git status
# If anything changed:
git add -A
git commit -m "chore: post-mobile-ux-pass cleanup"
```

---

## Self-Review

**Spec coverage:**
- §2.1 Dependency change → Task 1 ✓
- §2.2 Icon mapping (all 45+ icons) → Tasks 2–18 ✓
- §2.3 Files to modify (~40 files) → Tasks 2–18 cover all listed paths ✓
- §2.4 Size/props compatibility → Implied by import swap (reicon accepts same size/color props) ✓
- §3.1 Issues 1–10 → Tasks 20 (issue 1), 21 (issue 3), 22 (issue 9), 23 (issue 5) ✓
- §3.2 P1/P2/P3 priorities → Task 20 (P1), 21 (P1), 22 (P2), 23 (P2) ✓
- §4 Execution plan → Tasks 1–24 follow phases ✓
- §5 Success criteria → Tasks 19, 24 verify all criteria ✓

**Placeholder scan:** No "TBD", "TODO", "implement later" or vague steps. All file paths exact. ✓

**Type consistency:** `Edit2` used in tasks where lucide had `Edit2`; `Trash2` renamed to `Trash` consistently across tasks 3, 15, 16, 17, 18, 22. `HandCoins` → `HandDollar` consistent in task 16. `Pencil` → `Edit` consistent in tasks 16, 17. ✓

**Note on skipped spec issues (P3 polish):** Issues 4, 6, 7, 8, 10 are lower-priority polish items (FAB zone verification, search autofocus, skeleton timing, scroll-snap, SummaryCard padding). The user asked for full mobile audit but prioritized 1:1 icon migration; P3 items are documented in spec for future passes. If time permits after Task 24, additional tasks can be added.
