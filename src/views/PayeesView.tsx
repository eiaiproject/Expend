import React, { useState, useMemo, useRef, useEffect, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Search, ArrowLeft, ShoppingBag, Edit2, X, Filter, ArrowUpDown, Plus } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatCurrency } from '../utils/formatUtils';
import { displayDateMedium } from '../utils/dateUtils';
import { getPayeeStatsFromTransactions, filterTransactionsByPayee, normalizePayeeKey, normalizePayeeName, type PayeeStats, type PayeeSortConfig, type PayeeTransactionFilters, type PayeeAggregateFilters } from '../services/payeeService';
import { TransactionCard } from '../components/home/TransactionCard';
import { EmptyState } from '../components/EmptyState';
import { toast } from '../components/Toaster';
import { PayeeSortSheet } from '../components/PayeeSortSheet';
import { PayeeFilterSheet, type PayeeFilterDraft } from '../components/PayeeFilterSheet';

const TransactionFormSheet = lazy(() => import('../components/TransactionFormSheet').then(m => ({ default: m.TransactionFormSheet })));

const EMPTY_FILTER_DRAFT: PayeeFilterDraft = {
  categoryIds: [],
  walletIds: [],
  startDate: '',
  endDate: '',
  minTotalExpense: '',
  maxTotalExpense: '',
  minTransactionCount: '',
  maxTransactionCount: '',
};

export default function PayeesView() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayee, setSelectedPayee] = useState<PayeeStats | null>(null);
  const [renamingPayee, setRenamingPayee] = useState<PayeeStats | null>(null);
  const [newPayeeName, setNewPayeeName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Sort & filter state
  const [sortConfig, setSortConfig] = useState<PayeeSortConfig>({ field: 'totalExpense', order: 'desc' });
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<PayeeFilterDraft>(EMPTY_FILTER_DRAFT);

  // Quick-add expense state
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txInitialDescription, setTxInitialDescription] = useState<string | undefined>();

  // Build transaction-level filters from draft
  const transactionFilters: PayeeTransactionFilters | undefined = useMemo(() => {
    const hasTxFilter = filterDraft.categoryIds.length > 0 || filterDraft.walletIds.length > 0 || filterDraft.startDate || filterDraft.endDate;
    if (!hasTxFilter) return undefined;
    return {
      categoryIds: filterDraft.categoryIds.length > 0 ? filterDraft.categoryIds : undefined,
      walletIds: filterDraft.walletIds.length > 0 ? filterDraft.walletIds : undefined,
      startDate: filterDraft.startDate || undefined,
      endDate: filterDraft.endDate || undefined,
    };
  }, [filterDraft]);

  // Build aggregate-level filters from draft
  const aggregateFilters: PayeeAggregateFilters | undefined = useMemo(() => {
    const hasAggFilter = filterDraft.minTotalExpense || filterDraft.maxTotalExpense || filterDraft.minTransactionCount || filterDraft.maxTransactionCount;
    if (!hasAggFilter) return undefined;
    return {
      minTotalExpense: filterDraft.minTotalExpense ? parseInt(filterDraft.minTotalExpense, 10) : undefined,
      maxTotalExpense: filterDraft.maxTotalExpense ? parseInt(filterDraft.maxTotalExpense, 10) : undefined,
      minTransactionCount: filterDraft.minTransactionCount ? parseInt(filterDraft.minTransactionCount, 10) : undefined,
      maxTransactionCount: filterDraft.maxTransactionCount ? parseInt(filterDraft.maxTransactionCount, 10) : undefined,
    };
  }, [filterDraft]);

  const activeFilterCount = useMemo(() => (
    filterDraft.categoryIds.length +
    filterDraft.walletIds.length +
    (filterDraft.startDate ? 1 : 0) +
    (filterDraft.endDate ? 1 : 0) +
    (filterDraft.minTotalExpense ? 1 : 0) +
    (filterDraft.maxTotalExpense ? 1 : 0) +
    (filterDraft.minTransactionCount ? 1 : 0) +
    (filterDraft.maxTransactionCount ? 1 : 0)
  ), [filterDraft]);

  const payees = useLiveQuery(async () => {
    return await getPayeeStatsFromTransactions({
      transactionFilters,
      aggregateFilters,
      sort: sortConfig,
    });
  }, [sortConfig, transactionFilters, aggregateFilters]);

  const categories = useLiveQuery(() => db.categories.toArray(), [], []);
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], []);

  const categoryMap = useMemo(() => {
    return (categories ?? []).reduce((acc, category) => {
      if (category.id != null) acc[category.id] = category;
      return acc;
    }, {} as Record<number, import('../db/db').Category>);
  }, [categories]);

  const walletMap = useMemo(() => {
    return (wallets ?? []).reduce((acc, wallet) => {
      if (wallet.id != null) acc[wallet.id] = wallet;
      return acc;
    }, {} as Record<number, import('../db/db').Wallet>);
  }, [wallets]);

  const filteredPayees = useMemo(() => {
    if (!payees) return [];
    if (!searchQuery.trim()) return payees;
    const lower = searchQuery.toLowerCase();
    return payees.filter(p => p.name.toLowerCase().includes(lower));
  }, [payees, searchQuery]);

  useEffect(() => {
    if (renamingPayee && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPayee]);

  const handleRename = async () => {
    if (!renamingPayee || !newPayeeName.trim()) return;
    const oldKey = renamingPayee.key;
    const trimmedName = normalizePayeeName(newPayeeName);
    
    if (renamingPayee.name === trimmedName) {
      setRenamingPayee(null);
      return;
    }

    await db.transactions
      .where('type')
      .equals('expense')
      .filter((tx) => normalizePayeeKey(tx.description) === oldKey)
      .modify({ description: trimmedName });
    
    toast.add(t('Renamed to') + ' ' + trimmedName);
    setRenamingPayee(null);
    setSelectedPayee(null);
  };

  // Pass transaction-level filters to detail view for consistency
  const selectedPayeeTransactions = useLiveQuery(async () => {
    if (!selectedPayee) return [];
    return await filterTransactionsByPayee(selectedPayee.key, transactionFilters);
  }, [selectedPayee, transactionFilters]);

  const handleApplyFilter = useCallback((draft: PayeeFilterDraft) => {
    setFilterDraft(draft);
  }, []);

  const handleApplySort = useCallback((config: PayeeSortConfig) => {
    setSortConfig(config);
  }, []);

  const openAddExpenseForPayee = useCallback((payeeName: string) => {
    setTxInitialDescription(payeeName);
    setIsAddTxOpen(true);
  }, []);

  const closeAddTxForm = useCallback(() => {
    setIsAddTxOpen(false);
    setTxInitialDescription(undefined);
  }, []);

  const renameDialog = renamingPayee ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-[var(--card)] w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-label={t('Rename')}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{t('Rename')}</h3>
          <button
            onClick={() => setRenamingPayee(null)}
            className="p-1 rounded-full hover:bg-[var(--bg)]"
            aria-label={t('Close')}
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {t('All transactions with')} <span className="font-bold">{renamingPayee.name}</span> {t('will be renamed')}
        </p>
        <input
          ref={renameInputRef}
          type="text"
          value={newPayeeName}
          onChange={(e) => setNewPayeeName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
        />
        <div className="flex gap-3">
          <button
            onClick={() => setRenamingPayee(null)}
            className="flex-1 py-3 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={handleRename}
            disabled={!newPayeeName.trim()}
            className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {t('Rename')}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Detail view
  if (selectedPayee) {
    return (
      <>
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedPayee(null)}
            className="p-2 bg-[var(--card)] border border-[var(--border)] rounded-full text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            aria-label={t('Back')}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{selectedPayee.name}</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('Transactions history')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1 min-w-0">
            <p className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('Total Spent')}</p>
            <p className="text-lg sm:text-xl font-mono font-bold text-red-500 truncate">{formatCurrency(selectedPayee.totalExpense)}</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1 min-w-0">
            <p className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('Count')}</p>
            <p className="text-lg sm:text-xl font-mono font-bold truncate">{selectedPayee.transactionCount} {t('Txs')}</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1 min-w-0">
            <p className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('Average')}</p>
            <p className="text-lg sm:text-xl font-mono font-bold truncate">{formatCurrency(selectedPayee.averageAmount)}</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-1 min-w-0">
            <p className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-wider">{t('Last Date')}</p>
            <p className="text-sm font-medium truncate">{displayDateMedium(selectedPayee.lastTransactionDate, i18n.language)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-bold">{t('History')}</h3>
          {selectedPayeeTransactions && selectedPayeeTransactions.length > 0 ? (
            <div className="space-y-2">
              {selectedPayeeTransactions.map(tx => (
                <TransactionCard
                  key={tx.id}
                  tx={tx}
                  categoryMap={categoryMap}
                  walletMap={walletMap}
                  searchTerm=""
                  hideAmount={false}
                  isSelectionMode={false}
                  isSelected={false}
                  onSelect={() => {}}
                  onClick={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          ) : (
            <EmptyState 
              title={t('No transactions found')} 
              description={t('No transactions found for this merchant')}
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => openAddExpenseForPayee(selectedPayee.name)}
            className="flex-1 flex items-center justify-center gap-2 p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-[16px] hover:border-[var(--accent)]/40 transition-colors"
          >
            <Plus size={18} className="text-[var(--accent)]" />
            <span className="font-medium text-[var(--accent)]">{t('Add Expense')}</span>
          </button>
          <button
            onClick={() => {
              setRenamingPayee(selectedPayee);
              setNewPayeeName(selectedPayee.name);
            }}
            className="flex-1 flex items-center justify-center gap-2 p-4 bg-[var(--card)] border border-[var(--border)] rounded-[16px] hover:border-[var(--accent)]/40 transition-colors"
          >
            <Edit2 size={18} />
            <span className="font-medium">{t('Rename')}</span>
          </button>
        </div>

        {renameDialog}
      </div>

      <Suspense fallback={null}>
        <TransactionFormSheet
          isOpen={isAddTxOpen}
          onClose={closeAddTxForm}
          initialDescription={txInitialDescription}
        />
      </Suspense>
      </>
    );
  }

  // List view
  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('Recipients & Merchants')}</h1>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={18} />
        <input 
          type="text" 
          placeholder={t('Search Merchant')} 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
        />
      </div>

      {/* Sort & Filter buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsFilterOpen(true)}
          className={cn(
            "relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm font-medium",
            activeFilterCount > 0
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)] active:bg-[var(--border)]"
          )}
          aria-label={t('Filter Type')}
        >
          <Filter size={14} />
          <span>{t('Filter')}</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-white/20 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setIsSortOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)] active:bg-[var(--border)] transition-colors text-sm font-medium"
          aria-label={t('Sort Payees')}
        >
          <ArrowUpDown size={14} />
          <span>{t('Sort')}</span>
        </button>
      </div>

      <div className="space-y-3">
        {filteredPayees.length === 0 ? (
          <EmptyState 
            icon={<ShoppingBag size={48} className="opacity-20" />}
            title={t('No Merchants Found')} 
            description={activeFilterCount > 0 ? t('Try changing your filter or search keywords.') : t('Add some expense transactions to see your merchants here.')}
          />
        ) : (
          filteredPayees.map(payee => (
            <div
              key={payee.key}
              className="flex items-center p-4 bg-[var(--card)] border border-[var(--border)] rounded-[16px] hover:border-[var(--accent)]/40 transition-[border-color,box-shadow] active:scale-[0.98] group"
            >
              <button
                onClick={() => setSelectedPayee(payee)}
                className="flex-1 flex items-center gap-3 min-w-0 text-left"
              >
                <div className="p-2 bg-[var(--bg)] rounded-xl text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors">
                  <ShoppingBag size={20} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold truncate">{payee.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {payee.transactionCount} {t('Txs')} • {t('Avg')} {formatCurrency(payee.averageAmount)}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="font-mono font-bold text-[var(--expense)]">{formatCurrency(payee.totalExpense)}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold">{t('Total Spent')}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); openAddExpenseForPayee(payee.name); }}
                  className="p-2 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors active:scale-90"
                  aria-label={t('Add Expense for {{name}}', { name: payee.name })}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <PayeeSortSheet
        isOpen={isSortOpen}
        onClose={() => setIsSortOpen(false)}
        sortConfig={sortConfig}
        onApply={handleApplySort}
      />

      <PayeeFilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        draft={filterDraft}
        onApply={handleApplyFilter}
        categories={categories ?? []}
        wallets={wallets ?? []}
      />

      {renameDialog}
    </div>

    <Suspense fallback={null}>
      <TransactionFormSheet
        isOpen={isAddTxOpen}
        onClose={closeAddTxForm}
        initialDescription={txInitialDescription}
      />
    </Suspense>
    </>
  );
}
