import { useEffect, useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { useOverflow } from '../hooks/useOverflow';
import { useKeyboardShortcutGuard } from '../hooks/useKeyboardShortcut';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../db/db';
import { Eye, EyeOff, Moon, Sun, Filter, SortV, Search, XCircle, Trash2, Handshake, Repeat, ClipboardAdd } from 'reicon-react';
import { topRecentPayees } from '../services/payeeService';
import { cn } from '../utils/cn';
import { useTheme } from '../contexts/ThemeContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { TransactionDetailSheet } from '../components/TransactionDetailSheet';
import { toast } from '../components/Toaster';
import { deleteTransactionsWithPairs, restoreTransactions } from '../services/deleteTransactionService';
import { computeDailySpending, generateInsight } from '../services/budgetService';
import { buildDebtPaymentsMap, summarizeDebts } from '../services/debtService';
import { getUpcomingItems, type UpcomingItem } from '../services/recurringService';
import { findPairedTransfer } from '../utils/transferUtils';

import { Skeleton } from '../components/Skeleton';
import { addDays, displayDateLong, getTodayStr, getYesterdayStr, getWeekStartStr, getMonthStartStr, normaliseDate } from '../utils/dateUtils';
import type { TransactionType } from '../hooks/useTransactionForm';
import { formatCurrency } from '../utils/formatUtils';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useTransactionSelection } from '../hooks/useTransactionSelection';

// Home sub-components
import { SummaryCard } from '../components/home/SummaryCard';
import { ActiveFilterChips } from '../components/home/ActiveFilterChips';
import { TransactionGroup } from '../components/home/TransactionGroup';
import { EmptyState } from '../components/EmptyState';
import { UpcomingSection } from '../components/UpcomingSection';
import { InsightsCard } from '../components/InsightsCard';
import { PageHeader } from '../components/PageHeader';
import {
  generateInsights,
  getDismissedInsightIds,
  dismissInsight,
} from '../services/insightsService';

const TransactionFormSheet = lazy(() => import('../components/TransactionFormSheet').then(m => ({ default: m.TransactionFormSheet })));
const FilterSheet = lazy(() => import('../components/FilterSheet').then(m => ({ default: m.FilterSheet })));
const BatchEntrySheet = lazy(() => import('../components/BatchEntrySheet').then(m => ({ default: m.BatchEntrySheet })));

const TRANSACTION_RENDER_PAGE_SIZE = 100;

// ── Quick Filter Chips ────────────────────────────────────────

interface QuickFilterChipsProps {
  readonly isSelectionMode: boolean;
  readonly quickFilter: 'today' | 'week' | null;
  readonly onSelect: (value: 'today' | 'week' | null) => void;
  readonly t: (key: string) => string;
}

function QuickFilterChips({ isSelectionMode, quickFilter, onSelect, t }: QuickFilterChipsProps) {
  // Edge fade only when the chips actually overflow the screen (master.md Phase 7).
  const { ref: chipsRef, overflows: hasOverflow } = useOverflow<HTMLFieldSetElement>();
  if (isSelectionMode) return null;
  const label = (qf: 'today' | 'week'): string => {
    if (qf === 'today') return t('home.filterToday');
    return t('home.filterThisWeek');
  };

  return (
    <fieldset
      ref={chipsRef}
      className={cn(
        "flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-1 pb-1 border-0 p-0 m-0",
        hasOverflow && "scroll-fade-x"
      )}
      aria-label={t('home.filterTransactions')}
      style={{ scrollbarWidth: 'auto', scrollPaddingInline: '1rem' }}
    >
      {(['today', 'week'] as const).map(qf => {
        const isActive = quickFilter === qf;
        return (
          <button type="button"
            key={qf}
            onClick={() => onSelect(isActive ? null : qf)}
            aria-pressed={isActive}
            className={cn(
              "shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors active:scale-95 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30",
              isActive
                ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]"
                : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)]"
            )}
          >
            {label(qf)}
          </button>
        );
      })}
      {quickFilter && (
        <button type="button"
          onClick={() => onSelect(null)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--expense)] transition-colors active:scale-95 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
        >
          {t('home.clearFilters')}
        </button>
      )}
    </fieldset>
  );
}

// ── Transaction List Header + Controls ────────────────────────

interface TransactionListControlsProps {
  readonly isSelectionMode: boolean;
  readonly selectedIds: readonly number[];
  readonly filteredCount: number;
  readonly isFilterOpen: boolean;
  readonly activeFilterCount: number;
  readonly sortLabel: string;
  readonly onExitSelection: () => void;
  readonly onEnterSelection: () => void;
  readonly onToggleFilter: () => void;
  readonly onToggleSort: () => void;
  readonly onSelectAll: () => void;
  readonly onDeselectAll: () => void;
  readonly onBulkDelete: () => void;
  readonly t: (key: string, opts?: Record<string, string | number>) => string;
}

function TransactionListControls({
  isSelectionMode,
  selectedIds,
  filteredCount,
  isFilterOpen,
  activeFilterCount,
  sortLabel,
  onExitSelection,
  onEnterSelection,
  onToggleFilter,
  onToggleSort,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  t,
}: TransactionListControlsProps) {
  const allSelected = selectedIds.length === filteredCount;
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        {!isSelectionMode ? (
          <h2 className="text-lg font-bold">{t('Recent Transactions')}</h2>
        ) : (
          <>
            <button type="button"
              onClick={onExitSelection}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              aria-label={t('home.cancelSelection')}
            >
              <XCircle size={20} />
            </button>
            <span className="text-lg font-bold">{t('home.selectedCount', { count: selectedIds.length })}</span>
          </>
        )}
      </div>
      <div className="flex gap-1">
        {!isSelectionMode ? (
          <>
            <button type="button"
              onClick={onEnterSelection}
              className="h-11 px-3 flex items-center justify-center rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
            >
              {t('home.selectTransactions')}
            </button>
            <button type="button"
              onClick={onToggleFilter}
              className={cn(
                "relative w-11 h-11 flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30",
                isFilterOpen
                  ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]"
                  : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)]"
              )}
              aria-label={activeFilterCount > 0 ? t('home.filterTransactions') + ', ' + t('home.filterActive', { count: activeFilterCount }) : t('home.filterTransactions')}
              aria-expanded={isFilterOpen}
              aria-haspopup="dialog"
            >
              <Filter size={18} />
              {activeFilterCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--accent-fill)] text-[var(--accent-ink)] text-[9px] font-bold flex items-center justify-center pointer-events-none">
                  {activeFilterCount}
                </span>
              )}
              <kbd className="absolute -bottom-1 -right-1 hidden md:inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[8px] font-mono font-bold text-[var(--text-secondary)] shadow-sm" aria-hidden="true">
                F
              </kbd>
            </button>
            <button type="button"
              onClick={onToggleSort}
              className="relative w-11 h-11 flex items-center justify-center rounded-lg border bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              aria-label={sortLabel}
            >
              <SortV size={18} />
              <kbd className="absolute -bottom-1 -right-1 hidden md:inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[8px] font-mono font-bold text-[var(--text-secondary)] shadow-sm" aria-hidden="true">
                S
              </kbd>
            </button>
          </>
        ) : (
          <>
            <button type="button"
              onClick={allSelected ? onDeselectAll : onSelectAll}
              className="h-11 px-3 flex items-center justify-center rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
            >
              {allSelected ? t('home.deselectAll') : t('home.selectAll')}
            </button>
            {selectedIds.length > 0 && (
              <button type="button"
                onClick={onBulkDelete}
                className="h-11 px-3 flex items-center justify-center gap-2 bg-red-500 text-white rounded-lg border border-red-600 transition-colors hover:bg-red-600 active:scale-95 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30"
                aria-label={t('Bulk Delete')}
              >
                <Trash2 size={16} />
                {t('Delete')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HomeView() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { hideAmount, toggleHideAmount } = usePrivacy();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [repeatInitials, setRepeatInitials] = useState<{
    initialType?: TransactionType;
    initialDescription?: string;
    initialFromWalletId?: number;
    initialToWalletId?: number;
    initialAmount?: string;
    initialNotes?: string;
  } | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Web Share Target prefill (automation B2): router state from ShareTargetView.
  useEffect(() => {
    const share = location.state?.share as { initialDescription?: string; initialAmount?: string } | undefined;
    if (share) {
      setEditTx(null);
      setRepeatInitials({
        initialType: 'expense',
        initialDescription: share.initialDescription,
        initialAmount: share.initialAmount,
      });
      setIsFormOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const [expensePeriod, setExpensePeriod] = useState<'month' | 'all'>('month');
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(TRANSACTION_RENDER_PAGE_SIZE);
  const [sortConfig, setSortConfig] = useState<{ field: string; order: 'asc' | 'desc' }>({
    field: 'date',
    order: 'desc',
  });

  const toggleSortOrder = useCallback(() => {
    setSortConfig(prev => ({
      ...prev,
      order: prev.order === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const { isSelectionMode, selectedIds, enterSelectionMode, exitSelectionMode, toggleSelection, handleBulkDelete, isSelected, selectAll, deselectAll } = useTransactionSelection(t);

  // Database queries
  const transactions = useLiveQuery(() => {
    let query = db.transactions.orderBy(sortConfig.field);
    if (sortConfig.order === 'desc') {
      return query.reverse().toArray();
    }
    return query.toArray();
  }, [sortConfig], undefined);

  const categories = useLiveQuery(() => db.categories.toArray(), [], undefined);
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], undefined);
  const debtRecords = useLiveQuery(() => db.debts.toArray(), [], undefined);
  const debtPayments = useLiveQuery(() => db.debtPayments.toArray(), [], undefined);
  const schedules = useLiveQuery(() => db.schedules.toArray(), [], undefined);
  const dismissedInsightIds = useLiveQuery(() => getDismissedInsightIds(), [], new Set<string>());

  // Filter hook
  const {
    filters,
    actions: filterActions,
    filteredTransactions,
    searchRef,
    activeCategories,
    activeWallets,
  } = useTransactionFilters(transactions, categories, wallets);

  const isLoading = transactions === undefined || categories === undefined || wallets === undefined;

  useEffect(() => {
    setVisibleTransactionCount(TRANSACTION_RENDER_PAGE_SIZE);
  }, [filteredTransactions]);

  const visibleFilteredTransactions = useMemo(
    () => filteredTransactions.slice(0, visibleTransactionCount),
    [filteredTransactions, visibleTransactionCount],
  );
  const hasMoreTransactions = visibleTransactionCount < filteredTransactions.length;

  const hasActiveFilter =
    !!filters.searchTerm ||
    filters.categories.length > 0 ||
    filters.wallets.length > 0 ||
    !!filters.startDate ||
    !!filters.endDate ||
    filters.type !== 'all' ||
    !!filters.quickFilter;

  const renderEmptyState = () => {
    if (hasActiveFilter) {
      return (
        <EmptyState
          title={t('home.emptySearchTitle')}
          description={t('home.emptySearchDescription')}
          action={{
            label: t('Reset All'),
            onClick: () => {
              filterActions.setType('all');
              filterActions.setCategories([]);
              filterActions.setWallets([]);
              filterActions.setStartDate('');
              filterActions.setEndDate('');
              filterActions.setMinAmount('');
              filterActions.setMaxAmount('');
              filterActions.setSearchTerm('');
              filterActions.setQuickFilter(null);
            },
          }}
        />
      );
    }
    return (
      <EmptyState
        title={t('home.emptyTitle')}
        description={t('home.emptyDescription')}
        action={{
          label: t('Add Transaction'),
          onClick: () => setIsFormOpen(true),
        }}
      />
    );
  };

  const renderTransactionList = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={`skel-${i}`} className="w-full h-20 rounded-[16px]" />
          ))}
        </div>
      );
    }
    if (filteredTransactions.length === 0) {
      return renderEmptyState();
    }
    return (
      <div className="space-y-6">
        {groupedTransactions.map(group => (
          <TransactionGroup
            key={group.labelKey}
            group={group}
            categoryMap={categoryMap}
            walletMap={walletMap}
            searchTerm={filters.searchTerm}
            hideAmount={hideAmount}
            isSelectionMode={isSelectionMode}
            isSelected={isSelected}
            toggleSelection={toggleSelection}
            setSelectedTx={setSelectedTx}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
          />
        ))}

        {hasMoreTransactions && (
          <button
            type="button"
            onClick={() => setVisibleTransactionCount((count) => count + TRANSACTION_RENDER_PAGE_SIZE)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
          >
            {t('Load More')}
          </button>
        )}
      </div>
    );
  };

  // Category and wallet maps for O(1) lookups
  const categoryMap = useMemo(() => {
    if (!categories) return {};
    return categories.reduce((acc, cat) => {
      if (cat.id != null) acc[cat.id] = cat;
      return acc;
    }, {} as Record<number, import('../db/db').Category>);
  }, [categories]);

  const walletMap = useMemo(() => {
    if (!wallets) return {};
    return wallets.reduce((acc, w) => {
      if (w.id != null) acc[w.id] = w;
      return acc;
    }, {} as Record<number, import('../db/db').Wallet>);
  }, [wallets]);

  // Initialize defaults if empty
  useEffect(() => {
    const initDefaults = async () => {
      const walletCount = await db.wallets.count();
      if (walletCount === 0) {
        await db.wallets.add({
          name: t('Main Wallet'),
          currency: 'IDR',
          initialBalance: 0,
          currentBalance: 0,
          lastUpdated: new Date().toISOString()
        });
      }
    };
    initDefaults();
  }, [t]);

  // Keyboard shortcuts — disabled when typing or in modal
  const isShortcutIgnored = useKeyboardShortcutGuard();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isShortcutIgnored(e)) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        toggleSortOrder();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFilterOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler as EventListener);
    return () => document.removeEventListener('keydown', handler as EventListener);
  }, [searchRef, toggleSortOrder, isShortcutIgnored]);

  const dailySummary = useMemo(() => {
    if (!transactions) return { today: 0, yesterday: 0 };
    return computeDailySpending(transactions);
  }, [transactions]);

  const smartInsight = useMemo(() => {
    if (!transactions || !categories) return null;
    return generateInsight(transactions, categories, t);
  }, [transactions, categories, t]);

  // Group transactions by period
  const groupedTransactions = useMemo(() => {
    if (!visibleFilteredTransactions?.length) return [];

    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();
    const weekStartStr = getWeekStartStr();

    const groups: { labelKey: string; count: number; transactions: Transaction[] }[] = [];

    const todayTxs: Transaction[] = [];
    const yesterdayTxs: Transaction[] = [];
    const weekTxs: Transaction[] = [];
    const earlierTxs: Transaction[] = [];

    for (const tx of visibleFilteredTransactions) {
      const txDate = normaliseDate(tx.date);
      if (txDate === todayStr) {
        todayTxs.push(tx);
      } else if (txDate === yesterdayStr) {
        yesterdayTxs.push(tx);
      } else if (txDate >= weekStartStr) {
        weekTxs.push(tx);
      } else {
        earlierTxs.push(tx);
      }
    }

    if (todayTxs.length > 0) groups.push({ labelKey: 'home.groupToday', count: todayTxs.length, transactions: todayTxs });
    if (yesterdayTxs.length > 0) groups.push({ labelKey: 'home.groupYesterday', count: yesterdayTxs.length, transactions: yesterdayTxs });
    if (weekTxs.length > 0) groups.push({ labelKey: 'home.groupThisWeek', count: weekTxs.length, transactions: weekTxs });
    if (earlierTxs.length > 0) groups.push({ labelKey: 'home.groupEarlier', count: earlierTxs.length, transactions: earlierTxs });

    return groups;
  }, [visibleFilteredTransactions]);

  // Calculate summary
  const totalExpense = useMemo(() => {
    const expenseTxs = filteredTransactions.filter(tx => tx.type === 'expense');
    if (expensePeriod === 'month') {
      const monthStart = getMonthStartStr();
      return expenseTxs.filter(tx => normaliseDate(tx.date) >= monthStart).reduce((sum, tx) => sum + tx.amount, 0);
    }
    return expenseTxs.reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTransactions, expensePeriod]);

  const walletsTotal = useMemo(() => {
    if (!wallets) return 0;
    return wallets.reduce((sum, w) => sum + (w.currentBalance ?? w.initialBalance), 0);
  }, [wallets]);

  const debtSummary = useMemo(() => {
    const paymentsByDebt = buildDebtPaymentsMap(debtPayments ?? []);
    return summarizeDebts(debtRecords ?? [], paymentsByDebt);
  }, [debtPayments, debtRecords]);

  const showDebtSummaryCard = debtSummary.activeCount > 0 || debtSummary.attentionCount > 0;

  // Upcoming section (master.md 7.4): schedule occurrences + debt due dates
  const upcomingItems: UpcomingItem[] = useMemo(() => {
    if (!debtRecords || !debtPayments) return [];
    const paymentsByDebt = buildDebtPaymentsMap(debtPayments);
    return getUpcomingItems(schedules ?? [], debtRecords, paymentsByDebt);
  }, [debtRecords, debtPayments, schedules]);

  const upcomingFrequencyLabel = useCallback(
    (frequency: string): string => {
      switch (frequency) {
        case 'weekly': return t('recurring.freqWeekly');
        case 'biweekly': return t('recurring.freqBiweekly');
        case 'monthly': return t('recurring.freqMonthly');
        case 'yearly': return t('recurring.freqYearly');
        default: return '';
      }
    },
    [t],
  );

  // Actionable insights (master.md 10) — deterministic, dismissed items
  // excluded, shown at most three by priority.
  // Friction audit B1: every insight builder only looks back up to 180 days
  // (its own cutoff), so feed a bounded slice — cheaper per-change recompute.
  // The full list stays unbounded for totals, search and filter dropdowns.
  const insights = useMemo(() => {
    if (transactions === undefined || categories === undefined || wallets === undefined) return [];
    const cutoff = addDays(getTodayStr(), -180);
    const recent = transactions.filter((tx) => normaliseDate(tx.date) >= cutoff);
    return generateInsights({
      transactions: recent,
      categories,
      wallets,
      debts: debtRecords ?? [],
      schedules: schedules ?? [],
      dismissedIds: dismissedInsightIds,
    });
  }, [transactions, categories, wallets, debtRecords, schedules, dismissedInsightIds]);

  const handleDismissInsight = useCallback((id: string) => {
    void dismissInsight(id);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type !== 'all') count++;
    count += filters.categories.length;
    count += filters.wallets.length;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    return count;
  }, [filters]);

  const handleEdit = useCallback((tx: Transaction) => {
    setEditTx(tx);
    setIsFormOpen(true);
  }, []);

  const handleRepeat = useCallback(async (tx: Transaction) => {
    // Strip unsafe identifiers (primary id, transfer group id) so a repeat
    // creates a brand-new transaction/pair (master.md 5.5).
    if (tx.type === 'expense') {
      const { id: _id, transferGroupId: _tg, ...rest } = tx;
      setEditTx({ ...rest, date: getTodayStr() });
      setIsFormOpen(true);
      return;
    }
    if (tx.type === 'transfer_in' || tx.type === 'transfer_out') {
      const paired = await findPairedTransfer(tx);
      if (!paired) {
        toast.add(t('Cannot repeat this transfer.'));
        return;
      }
      const outSide = tx.type === 'transfer_out' ? tx : paired;
      const inSide = tx.type === 'transfer_in' ? tx : paired;
      setEditTx(null);
      setRepeatInitials({
        initialType: 'transfer',
        initialDescription: tx.description.replace(/\s\((In|Out)\)$/, ''),
        initialFromWalletId: outSide.walletId,
        initialToWalletId: inSide.walletId,
        initialAmount: outSide.amount.toString(),
        initialNotes: outSide.notes ?? '',
      });
      setIsFormOpen(true);
    }
  }, [t]);

  const handleDelete = useCallback(async (tx: Transaction) => {
    if (!tx.id) return;
    const backups = await deleteTransactionsWithPairs([tx.id]);
    toast.add(t('Transaction Deleted'), async () => {
      await restoreTransactions(backups);
    });
  }, [t]);

  const sortLabel = sortConfig.order === 'desc' ? t('home.sortNewest') : t('home.sortOldest');

  return (
    <div className="space-y-6">
      {/* Page Header — single H1 */}
      <PageHeader
        title={t('home.title')}
        description={displayDateLong(new Date(), i18n.language)}
        actions={
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              aria-label={theme === 'dark' ? t('home.useLightTheme') : t('home.useDarkTheme')}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button type="button"
              onClick={toggleHideAmount}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              aria-label={hideAmount ? t('home.showBalance') : t('home.hideBalance')}
              aria-pressed={hideAmount}
            >
              {hideAmount ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        }
      />

      {/* Live region for privacy mode announcement */}
      <div className="sr-only" aria-live="polite">
        {hideAmount ? t('home.amountsHidden') : t('home.amountsShown')}
      </div>

      {/* Summary Card */}
      <SummaryCard
        isLoading={isLoading}
        walletsTotal={walletsTotal}
        totalExpense={totalExpense}
        expensePeriod={expensePeriod}
        onToggleExpensePeriod={() => setExpensePeriod(prev => prev === 'month' ? 'all' : 'month')}
        dailySummary={dailySummary}
        smartInsight={smartInsight}
        hideAmount={hideAmount}
      />

      {/* Upcoming (compact — max 3 items) */}
      <UpcomingSection
        items={upcomingItems}
        hideAmount={hideAmount}
        frequencyLabel={upcomingFrequencyLabel}
        viewAllTarget={upcomingItems.some((item) => item.kind === 'debt') ? '/debts' : '/schedules'}
      />

      {/* Actionable insights (compact — max 3 items) */}
      <InsightsCard
        insights={insights}
        hideAmount={hideAmount}
        onDismiss={handleDismissInsight}
      />

      {/* Debt Summary */}
      {showDebtSummaryCard && (
        <Link
          to="/debts"
          className="block rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
                <Handshake size={16} />
              </div>
              <h2 className="font-bold">{t('Debts & Receivables')}</h2>
            </div>
            <span className="text-xs font-bold text-[var(--accent)]">{t('View')}</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)]">{t('Active Debts')}</span>
              <span className="font-mono font-bold text-[var(--warning)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {hideAmount ? '•••••' : formatCurrency(debtSummary.payableTotal)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)]">{t('Active Receivables')}</span>
              <span className="font-mono font-bold text-[var(--accent)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {hideAmount ? '•••••' : formatCurrency(debtSummary.receivableTotal)}
              </span>
            </div>
            {debtSummary.attentionCount > 0 && (
              <p className="text-xs font-bold text-[var(--danger)]">{t('needs attention count', { count: debtSummary.attentionCount })}</p>
            )}
          </div>
        </Link>
      )}

      {/* Search */}
      <search aria-label={t('home.searchLabel')}>
        <label htmlFor="home-search" className="sr-only">{t('home.searchLabel')}</label>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={18} aria-hidden="true" />
          <input
            ref={searchRef}
            id="home-search"
            type="search"
            name="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t('home.searchPlaceholder')}
            value={filters.searchTerm}
            onChange={(e) => filterActions.setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-12 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] placeholder:text-[var(--text-secondary)]"
          />
          {filters.searchTerm && (
            <button
              type="button"
              onClick={() => filterActions.setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors -mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              aria-label={t('home.clearSearch')}
            >
              <XCircle size={18} />
            </button>
          )}
          {!filters.searchTerm && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center justify-center w-6 h-6 rounded border border-[var(--border)] bg-[var(--bg)] text-[10px] font-mono font-bold text-[var(--text-secondary)] pointer-events-none" aria-hidden="true">
              /
            </kbd>
          )}
        </div>
      </search>

      {/* Active Filter Chips */}
      <ActiveFilterChips
        filters={filters}
        filterActions={filterActions}
        categoryMap={categoryMap}
        walletMap={walletMap}
      />

      {/* Quick Filter Chips */}
      <QuickFilterChips
        isSelectionMode={isSelectionMode}
        quickFilter={filters.quickFilter}
        onSelect={filterActions.setQuickFilter}
        t={t}
      />

      {/* Recent payees — one-tap re-entry (automation B1) */}
      {!isSelectionMode && transactions && transactions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" aria-label={t('home.recentPayees')}>
          {topRecentPayees(transactions, 5).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setEditTx(null);
                setRepeatInitials({
                  initialType: 'expense',
                  initialDescription: p.name,
                  initialAmount: String(p.amount),
                });
                setIsFormOpen(true);
              }}
              className="shrink-0 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] active:scale-95 transition-colors min-h-[44px] flex items-center gap-1.5"
            >
              <Repeat size={14} aria-hidden="true" />
              {p.name} · {formatCurrency(p.amount)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsBatchOpen(true)}
            className="shrink-0 px-3 py-2 bg-[var(--card)] border border-dashed border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-colors min-h-[44px] flex items-center gap-1.5"
          >
            <ClipboardAdd size={14} aria-hidden="true" />
            {t('batch.title')}
          </button>
        </div>
      )}

      {/* Transaction List Header + Controls */}
      <TransactionListControls
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        filteredCount={filteredTransactions.length}
        isFilterOpen={isFilterOpen}
        activeFilterCount={activeFilterCount}
        sortLabel={sortLabel}
        onExitSelection={exitSelectionMode}
        onEnterSelection={enterSelectionMode}
        onToggleFilter={() => setIsFilterOpen(prev => !prev)}
        onToggleSort={toggleSortOrder}
        onSelectAll={() => selectAll(filteredTransactions.map(tx => tx.id!).filter(id => id != null))}
        onDeselectAll={deselectAll}
        onBulkDelete={handleBulkDelete}
        t={t}
      />

      {/* Filter Sheet */}
      {!isLoading && (
        <Suspense fallback={null}>
          <FilterSheet
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            categories={activeCategories || []}
            wallets={activeWallets || []}
            filters={{
              type: filters.type,
              setType: filterActions.setType,
              categories: filters.categories,
              setCategories: filterActions.setCategories,
              wallets: filters.wallets,
              setWallets: filterActions.setWallets,
              startDate: filters.startDate,
              setStartDate: filterActions.setStartDate,
              endDate: filters.endDate,
              setEndDate: filterActions.setEndDate,
              minAmount: filters.minAmount,
              setMinAmount: filterActions.setMinAmount,
              maxAmount: filters.maxAmount,
              setMaxAmount: filterActions.setMaxAmount,
            }}
          />
        </Suspense>
      )}

      {/* Transaction List */}
      {renderTransactionList()}

      <TransactionDetailSheet
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRepeat={handleRepeat}
      />

      <Suspense fallback={null}>
        <TransactionFormSheet
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditTx(null); setRepeatInitials(null); }}
          txToEdit={editTx}
          initialType={repeatInitials?.initialType}
          initialDescription={repeatInitials?.initialDescription}
          initialFromWalletId={repeatInitials?.initialFromWalletId}
          initialToWalletId={repeatInitials?.initialToWalletId}
          initialAmount={repeatInitials?.initialAmount}
          initialNotes={repeatInitials?.initialNotes}
        />
      </Suspense>

      <Suspense fallback={null}>
        <BatchEntrySheet
          isOpen={isBatchOpen}
          onClose={() => setIsBatchOpen(false)}
        />
      </Suspense>
    </div>
  );
}
