import { useEffect, useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../db/db';
import { Eye, EyeOff, Moon, Sun, Filter, SortV, Search, XCircle, Trash2, Handshake } from 'reicon-react';
import { cn } from '../utils/cn';
import { useTheme } from '../contexts/ThemeContext';
import { usePrivacy } from '../contexts/PrivacyContext';
import { TransactionDetailSheet } from '../components/TransactionDetailSheet';
import { toast } from '../components/Toaster';
import { deleteTransactionsWithPairs, restoreTransactions } from '../services/deleteTransactionService';
import { computeDailySpending, generateInsight } from '../services/budgetService';
import { buildDebtPaymentsMap, summarizeDebts } from '../services/debtService';

import { Skeleton } from '../components/Skeleton';
import { displayDateLong, getTodayStr, getYesterdayStr, getWeekStartStr, getMonthStartStr, normaliseDate } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useTransactionSelection } from '../hooks/useTransactionSelection';

// Home sub-components
import { SummaryCard } from '../components/home/SummaryCard';
import { ActiveFilterChips } from '../components/home/ActiveFilterChips';
import { TransactionCard } from '../components/home/TransactionCard';
import { EmptyState } from '../components/EmptyState';

const TransactionFormSheet = lazy(() => import('../components/TransactionFormSheet').then(m => ({ default: m.TransactionFormSheet })));
const FilterSheet = lazy(() => import('../components/FilterSheet').then(m => ({ default: m.FilterSheet })));

const TRANSACTION_RENDER_PAGE_SIZE = 100;

export default function HomeView() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { hideAmount, toggleHideAmount } = usePrivacy();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable || target.hasAttribute('contenteditable') || target.getAttribute('role') === 'textbox';
      if (isEditable) return;
      if (document.querySelector('[role="dialog"]')) return; // NOSONAR S6819 — runtime detection
      if (e.metaKey || e.ctrlKey || e.altKey) return;

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
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchRef, toggleSortOrder]);

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

  const handleRepeat = useCallback((tx: Transaction) => {
    if (tx.type !== 'expense') return;
    const { id: _id, transferGroupId: _tg, ...rest } = tx;
    setEditTx({ ...rest, date: getTodayStr() });
    setIsFormOpen(true);
  }, []);

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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {t('home.title')}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {displayDateLong(new Date(), i18n.language)}
          </p>
        </div>
        <div className="flex items-center gap-1">
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
      </div>

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
              <span className="font-mono font-bold text-amber-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
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
              <p className="text-xs font-bold text-red-500">{t('needs attention count', { count: debtSummary.attentionCount })}</p>
            )}
          </div>
        </Link>
      )}

      {/* Search */}
      <search role="search" aria-label={t('home.searchLabel')}>
        <label htmlFor="home-search" className="sr-only">{t('home.searchLabel')}</label>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={18} aria-hidden="true" />
          <input
            ref={searchRef}
            id="home-search"
            type="search"
            name="search"
            autoComplete="off"
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
      {!isSelectionMode && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={t('home.filterTransactions')}
          style={{ scrollbarWidth: 'auto', scrollPaddingInline: '1rem' }}
        >
          {(['today', 'week', 'transfers'] as const).map(qf => {
            const label = qf === 'today' ? t('home.filterToday') : qf === 'week' ? t('home.filterThisWeek') : t('home.filterTransfers'); // ponytail: S2681+S3358, stable 3-state
            return (
              <button type="button"
                key={qf}
                onClick={() => filterActions.setQuickFilter(filters.quickFilter === qf ? null : qf)}
                aria-pressed={filters.quickFilter === qf}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors active:scale-95 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30",
                  filters.quickFilter === qf
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)]"
                )}
              >
                {label}
              </button>
            );
          })}
          {filters.quickFilter && (
            <button type="button"
              onClick={() => filterActions.setQuickFilter(null)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--expense)] transition-colors active:scale-95 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
            >
              {t('home.clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Transaction List Header + Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {!isSelectionMode ? (
            <h2 className="text-lg font-bold">{t('Recent Transactions')}</h2>
          ) : (
            <>
              <button type="button"
                onClick={exitSelectionMode}
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
                onClick={enterSelectionMode}
                className="h-11 px-3 flex items-center justify-center rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                {t('home.selectTransactions')}
              </button>
              <button type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "relative w-11 h-11 flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30",
                  isFilterOpen
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)]"
                )}
                aria-label={activeFilterCount > 0 ? t('home.filterTransactions') + ', ' + t('home.filterActive', { count: activeFilterCount }) : t('home.filterTransactions')}
                aria-expanded={isFilterOpen}
                aria-haspopup="dialog"
              >
                <Filter size={18} />
                {activeFilterCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
                    {activeFilterCount}
                  </span>
                )}
                <kbd className="absolute -bottom-1 -right-1 hidden md:inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[8px] font-mono font-bold text-[var(--text-secondary)] shadow-sm" aria-hidden="true">
                  F
                </kbd>
              </button>
              <button type="button"
                onClick={toggleSortOrder}
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
                onClick={selectedIds.length === filteredTransactions.length ? deselectAll : () => selectAll(filteredTransactions.map(tx => tx.id!).filter(id => id != null))}
                className="h-11 px-3 flex items-center justify-center rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                {selectedIds.length === filteredTransactions.length ? t('home.deselectAll') : t('home.selectAll')}
              </button>
              {selectedIds.length > 0 && (
                <button type="button"
                  onClick={handleBulkDelete}
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
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={`skel-${i}`} className="w-full h-20 rounded-[16px]" />
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        filters.searchTerm || filters.categories.length > 0 || filters.wallets.length > 0 || filters.startDate || filters.endDate || filters.type !== 'all' || filters.quickFilter ? (
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
        ) : (
          <EmptyState
            title={t('home.emptyTitle')}
            description={t('home.emptyDescription')}
            action={{
              label: t('Add Transaction'),
              onClick: () => setIsFormOpen(true),
            }}
          />
        )
      ) : (
        <div className="space-y-6">
          {groupedTransactions.map(group => {
            const groupId = group.labelKey.replace('home.group', '').toLowerCase();
            return (
              <section key={group.labelKey} aria-labelledby={`tx-group-${groupId}`}>
                <h3
                  id={`tx-group-${groupId}`}
                  className="sticky top-0 z-10 bg-[var(--bg)] pt-1 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider"
                >
                  {t(group.labelKey, { count: group.count })}
                </h3>
                <div className="space-y-2">
                  {group.transactions.map(tx => (
                    <TransactionCard
                      key={tx.id}
                      tx={tx}
                      categoryMap={categoryMap}
                      walletMap={walletMap}
                      searchTerm={filters.searchTerm}
                      hideAmount={hideAmount}
                      isSelectionMode={isSelectionMode}
                      isSelected={isSelected(tx.id!)}
                      onSelect={toggleSelection}
                      onClick={() => setSelectedTx(tx)}
                      onEdit={() => handleEdit(tx)}
                      onDelete={() => handleDelete(tx)}
                      onViewDetail={() => setSelectedTx(tx)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

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
      )}

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
          onClose={() => { setIsFormOpen(false); setEditTx(null); }}
          txToEdit={editTx}
        />
      </Suspense>
    </div>
  );
}
