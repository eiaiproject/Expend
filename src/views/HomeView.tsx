import { useEffect, useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../db/db';
import { Eye, EyeOff, ClipboardList, Filter, ArrowUpDown, Search, XCircle, X, Tag, Trash2, FileText, Handshake, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '../utils/cn';
import { TransactionDetailSheet } from '../components/TransactionDetailSheet';
import { InfoPopup } from '../components/InfoPopup';
import { toast } from '../components/Toaster';
import { deleteTransactionsWithPairs, restoreTransactions } from '../services/deleteTransactionService';
import { computeDailySpending, generateInsight } from '../services/budgetService';
import { buildDebtPaymentsMap, summarizeDebts } from '../services/debtService';


import { Skeleton } from '../components/Skeleton';
import { motion, AnimatePresence } from 'motion/react';
import { getTodayStr, getYesterdayStr, getWeekStartStr, getMonthStartStr, normaliseDate } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useTransactionSelection } from '../hooks/useTransactionSelection';
import { useTransactionSort } from '../hooks/useTransactionSort';

// Home sub-components
import { SummaryCard } from '../components/home/SummaryCard';
import { ActiveFilterChips } from '../components/home/ActiveFilterChips';
import { TransactionCard } from '../components/home/TransactionCard';
import { EmptyState } from '../components/EmptyState';

const TransactionFormSheet = lazy(() => import('../components/TransactionFormSheet').then(m => ({ default: m.TransactionFormSheet })));
const FilterSheet = lazy(() => import('../components/FilterSheet').then(m => ({ default: m.FilterSheet })));
const MonthlyReportPopup = lazy(() => import('../components/MonthlyReportPopup').then(m => ({ default: m.MonthlyReportPopup })));

const TRANSACTION_RENDER_PAGE_SIZE = 100;

export default function HomeView() {
  const { t, i18n } = useTranslation();
  const [hideAmount, setHideAmount] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [expensePeriod, setExpensePeriod] = useState<'month' | 'all'>('month');
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(TRANSACTION_RENDER_PAGE_SIZE);
  const [openActionTransactionId, setOpenActionTransactionId] = useState<number | null>(null);

  // Custom hooks
  const { sortConfig, toggleSortOrder } = useTransactionSort();
  const { isSelectionMode, selectedIds, enterSelectionMode, exitSelectionMode, toggleSelection, handleBulkDelete, isSelected } = useTransactionSelection(t);

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

  // Filter hook (must be after transactions query)
  const {
    filters,
    actions: filterActions,
    filteredTransactions,
    hasActiveFilters,
    searchRef,
    activeCategories,
    activeWallets,
  } = useTransactionFilters(transactions, sortConfig, categories, wallets);

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
          lastUpdated: new Date().toISOString()
        });
      }
    };
    initDefaults();
  }, [t]);

  // Close swipe action on mode/sheet changes
  useEffect(() => {
    setOpenActionTransactionId(null);
  }, [isSelectionMode]);

  useEffect(() => {
    setIsOverflowOpen(false);
  }, [isFilterOpen]);

  useEffect(() => {
    setOpenActionTransactionId(null);
  }, [isFormOpen]);

  useEffect(() => {
    setOpenActionTransactionId(null);
  }, [selectedTx]);

  // Keyboard shortcuts for the home view
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable || target.hasAttribute('contenteditable') || target.getAttribute('role') === 'textbox';
      if (isEditable) return;

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
    if (!visibleFilteredTransactions || !visibleFilteredTransactions.length) return [];

    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();
    const weekStartStr = getWeekStartStr();

    const groups: { labelKey: string; transactions: Transaction[] }[] = [];

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

    if (todayTxs.length > 0) groups.push({ labelKey: 'Today', transactions: todayTxs });
    if (yesterdayTxs.length > 0) groups.push({ labelKey: 'Yesterday', transactions: yesterdayTxs });
    if (weekTxs.length > 0) groups.push({ labelKey: 'This Week', transactions: weekTxs });
    if (earlierTxs.length > 0) groups.push({ labelKey: 'Earlier', transactions: earlierTxs });

    return groups;
  }, [visibleFilteredTransactions]);

  // Calculate summary based on filtered transactions and selected period
  const totalExpense = useMemo(() => {
    const expenseTxs = filteredTransactions.filter(tx => tx.type === 'expense');
    
    if (expensePeriod === 'month') {
      const monthStart = getMonthStartStr();
      return expenseTxs
        .filter(tx => normaliseDate(tx.date) >= monthStart)
        .reduce((sum, tx) => sum + tx.amount, 0);
    }
    
    // All time
    return expenseTxs.reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTransactions, expensePeriod]);

  // Use pre-computed currentBalance from DB (set by transactionSaveService)
  const walletsTotal = useMemo(() => {
    if (!wallets) return 0;
    return wallets.reduce((sum, w) => sum + (w.currentBalance ?? w.initialBalance), 0);
  }, [wallets]);

  const debtSummary = useMemo(() => {
    const paymentsByDebt = buildDebtPaymentsMap(debtPayments ?? []);
    return summarizeDebts(debtRecords ?? [], paymentsByDebt);
  }, [debtPayments, debtRecords]);

  const showDebtSummaryCard = debtSummary.activeCount > 0 || debtSummary.attentionCount > 0;

  // Close open swipe action when interacting with other UI
  const closeOpenAction = useCallback(() => setOpenActionTransactionId(null), []);

  const handleEdit = useCallback((tx: Transaction) => {
    closeOpenAction();
    setEditTx(tx);
    setIsFormOpen(true);
  }, [closeOpenAction]);

  const handleRepeat = useCallback((tx: Transaction) => {
    const { id: _id, transferGroupId: _tg, ...rest } = tx;
    setEditTx({ ...rest, date: getTodayStr() });
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback(async (tx: Transaction) => {
    closeOpenAction();
    if (!tx.id) return;
    const backups = await deleteTransactionsWithPairs([tx.id]);
    toast.add(t('Transaction Deleted'), async () => {
      await restoreTransactions(backups);
    });
  }, [t, closeOpenAction]);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
              Expend
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {format(new Date(), 'd MMMM yyyy', { 
                locale: i18n.language === 'id' ? localeId : undefined 
              })}
            </p>
          </div>
          
          <Link 
            to="/categories"
            className="ml-1 p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors rounded-lg hover:bg-[var(--card)]"
            aria-label={t('Categories & Budgets')}
          >
            <Tag size={18} />
          </Link>
          <div className="relative">
            <button 
              onClick={() => setIsOverflowOpen(!isOverflowOpen)}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors rounded-lg hover:bg-[var(--card)]"
              aria-label={t('More')}
              aria-expanded={isOverflowOpen}
              aria-haspopup="true"
            >
              <MoreVertical size={18} />
            </button>
            {isOverflowOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsOverflowOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[180px]">
                  <button
                    type="button"
                    onClick={() => { setIsOverflowOpen(false); setIsInfoOpen(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-secondary)]">
                      i
                    </div>
                    {t('Project Information')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsOverflowOpen(false); setIsReportOpen(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"
                  >
                    <FileText size={16} className="text-[var(--text-secondary)]" />
                    {t('Monthly Report')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <button 
          onClick={() => setHideAmount(!hideAmount)}
          className="p-2 bg-[var(--card)] rounded-full border border-[var(--border)]"
          aria-label={hideAmount ? t('Show Balance') : t('Hide Balance')}
        >
          {hideAmount ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      
      <InfoPopup isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />

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

      {showDebtSummaryCard && (
        <Link
          to="/debts"
          className="block rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent)]/40"
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
              <span className="font-mono font-bold text-amber-500">{formatCurrency(debtSummary.payableTotal, hideAmount)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)]">{t('Active Receivables')}</span>
              <span className="font-mono font-bold text-[var(--accent)]">{formatCurrency(debtSummary.receivableTotal, hideAmount)}</span>
            </div>
            {debtSummary.attentionCount > 0 && (
              <p className="text-xs font-bold text-red-500">{t('needs attention count', { count: debtSummary.attentionCount })}</p>
            )}
          </div>
        </Link>
      )}

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={18} />
        <input 
          ref={searchRef}
          type="text" 
          aria-label={t('Search Placeholder')}
          placeholder={t('Search Placeholder')} 
          value={filters.searchTerm}
          onChange={(e) => filterActions.setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-12 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all placeholder:text-[var(--text-secondary)]"
        />
        {filters.searchTerm && (
          <button
            type="button"
            onClick={() => filterActions.setSearchTerm('')}
            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label={t('Clear search')}
          >
            <XCircle size={16} />
          </button>
        )}
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center justify-center w-6 h-6 rounded border border-[var(--border)] bg-[var(--bg)] text-[10px] font-mono font-bold text-[var(--text-secondary)]">
          /
        </kbd>
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChips
        filters={filters}
        filterActions={filterActions}
        categoryMap={categoryMap}
        walletMap={walletMap}
      />

      {/* Quick Filter Chips */}
      {!isSelectionMode && (
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
          {(['today', 'week', 'transfers'] as const).map(qf => (
            <button
              key={qf}
              onClick={() => filterActions.setQuickFilter(filters.quickFilter === qf ? null : qf)}
              aria-pressed={filters.quickFilter === qf}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all active:scale-95",
                filters.quickFilter === qf
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)]"
              )}
            >
              {qf === 'today' ? t('Today') : qf === 'week' ? t('This Week') : t('Transfers Only')}
            </button>
          ))}
        </div>
      )}

      {/* Transaction List */}
      <div className="relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {!isSelectionMode && <h2 className="text-lg font-bold">{t('Recent Transactions')}</h2>}
            {isSelectionMode && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={exitSelectionMode}
                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  aria-label={t('Close')}
                >
                  <XCircle size={20} />
                </button>
                <span className="text-lg font-bold">{selectedIds.length} {t('Selected')}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!isSelectionMode && (
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "relative p-2 rounded-lg border transition-colors group",
                  isFilterOpen 
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]" 
                    : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)] active:bg-[var(--border)]"
                )}
                title={t('Filter Type')}
                aria-label={t('Filter Type')}
              >
                <Filter size={16} />
                <kbd className="absolute -top-1.5 -right-1.5 hidden md:inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[8px] font-mono font-bold text-[var(--text-secondary)] shadow-sm">
                  F
                </kbd>
              </button>
            )}
            {!isSelectionMode && (
              <button 
                onClick={toggleSortOrder}
                className="relative p-2 bg-[var(--card)] rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] active:bg-[var(--border)] transition-colors group"
                title={t('Sort Date')}
                aria-label={t('Sort Date')}
              >
                <ArrowUpDown size={16} />
                <kbd className="absolute -top-1.5 -right-1.5 hidden md:inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--bg)] text-[8px] font-mono font-bold text-[var(--text-secondary)] shadow-sm">
                  S
                </kbd>
              </button>
            )}
            {isSelectionMode && (
              <button 
                onClick={handleBulkDelete}
                className="p-2 bg-red-500 text-white rounded-lg border border-red-600 transition-colors hover:bg-red-600 active:scale-95"
                title={t('Bulk Delete')}
                aria-label={t('Bulk Delete')}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {!isLoading && (
          <Suspense fallback={null}>
            <FilterSheet 
              isOpen={isFilterOpen} 
              onClose={() => setIsFilterOpen(false)}
              categories={activeCategories || []}
              wallets={activeWallets || []}
              activeFilterCount={
                (filters.type !== 'all' ? 1 : 0) +
                filters.categories.length +
                filters.wallets.length +
                (filters.startDate ? 1 : 0) +
                (filters.endDate ? 1 : 0) +
                (filters.minAmount ? 1 : 0) +
                (filters.maxAmount ? 1 : 0)
              }
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
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="w-full h-20 rounded-[16px]" />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          filters.searchTerm || filters.categories.length > 0 || filters.wallets.length > 0 || filters.startDate || filters.endDate ? (
            <EmptyState
              title={t('No matching transactions')}
              description={t('Try changing your filter or search keywords.')}
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
                },
              }}
            />
          ) : (
            <EmptyState
              title={t('No Transactions')}
              description={t('Add your first transaction to start seeing your spending summary.')}
              action={{
                label: t('Add Transaction'),
                onClick: () => setIsFormOpen(true),
              }}
            />
          )
        ) : (
          <div className="space-y-6">
            {/* Selection Mode Toggle */}
            {!isSelectionMode && (
              <button 
                onClick={enterSelectionMode}
                className="w-full p-2 text-xs font-bold text-[var(--accent)] uppercase tracking-wider text-right mb-2 hover:underline"
              >
                {t('Select Multiple')}
              </button>
            )}

            {groupedTransactions.map(group => (
              <div key={group.labelKey}>
                <h3 className="sticky top-0 z-10 bg-[var(--bg)] pt-1 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                  <span>{t(group.labelKey)}</span>
                  <span className="text-[10px] font-mono text-[var(--text-secondary)]/50">{group.transactions.length}</span>
                </h3>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {group.transactions.map(tx => (
                      <motion.div
                        key={tx.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <TransactionCard
                          tx={tx}
                          categoryMap={categoryMap}
                          walletMap={walletMap}
                          searchTerm={filters.searchTerm}
                          hideAmount={hideAmount}
                          isSelectionMode={isSelectionMode}
                          isSelected={isSelected(tx.id!)}
                          isActionOpen={openActionTransactionId === tx.id}
                          onSelect={toggleSelection}
                          onClick={() => setSelectedTx(tx)}
                          onEdit={() => handleEdit(tx)}
                          onDelete={() => handleDelete(tx)}
                          onActionOpen={() => setOpenActionTransactionId(tx.id!)}
                          onActionClose={() => setOpenActionTransactionId(null)}
                          onViewDetail={() => setSelectedTx(tx)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}

            {hasMoreTransactions && (
              <button
                type="button"
                onClick={() => setVisibleTransactionCount((count) => count + TRANSACTION_RENDER_PAGE_SIZE)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
              >
                {t('Load More')}
              </button>
            )}
          </div>
        )}
      </div>

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

      <Suspense fallback={null}>
        <MonthlyReportPopup
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
        />
      </Suspense>
    </div>
  );
}
