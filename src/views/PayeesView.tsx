import React, { useState, useMemo, useRef, useEffect, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Merchant } from '../db/db';
import {
  Search, ShoppingBag, Plus, X, Filter, SortV, Star, StarOff
} from 'reicon-react';
import { cn } from '../utils/cn';
import { formatCurrency } from '../utils/formatUtils';
import { displayDateMedium } from '../utils/dateUtils';
import { usePrivacy } from '../contexts/PrivacyContext';
import { confirm } from '../components/ConfirmDialog';
import {
  getPayeeStatsFromTransactions, filterTransactionsByPayee,
  normalizePayeeKey, normalizePayeeName,
  type PayeeStats, type PayeeSortConfig, type PayeeSortField,
  type PayeeTransactionFilters, type PayeeAggregateFilters
} from '../services/payeeService';
import {
  renameMerchant, addMerchantAlias, removeMerchantAlias,
  archiveMerchant, restoreMerchant, syncMerchants
} from '../services/merchantService';
import {
  getFavoritePayeeKeys, toggleFavoritePayee
} from '../services/payeeFavoritesService';
import { TransactionCard } from '../components/home/TransactionCard';
import { EmptyState } from '../components/EmptyState';
import { toast } from '../components/Toaster';
import { PayeeSortSheet } from '../components/PayeeSortSheet';
import { PayeeFilterSheet, type PayeeFilterDraft } from '../components/PayeeFilterSheet';
import { CategoryOverflowMenu } from '../components/categories/CategoryOverflowMenu';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

const TransactionFormSheet = lazy(() => import('../components/TransactionFormSheet').then(m => ({ default: m.TransactionFormSheet })));

const EMPTY_FILTER_DRAFT: PayeeFilterDraft = {
  categoryIds: [], walletIds: [], startDate: '', endDate: '',
  minTotalExpense: '', maxTotalExpense: '', minTransactionCount: '', maxTransactionCount: '',
};

// ── Enriched merchant with stats ─────────────────────────────
interface MerchantWithStats extends Merchant {
  readonly stats: PayeeStats;
}

interface MerchantDetailViewProps {
  readonly merchant: MerchantWithStats;
  readonly favoriteKeySet: ReadonlySet<string>;
  readonly categoryMap: Record<number, import('../db/db').Category>;
  readonly walletMap: Record<number, import('../db/db').Wallet>;
  readonly transactions: readonly import('../db/db').Transaction[] | undefined;
  readonly hideAmount: boolean;
  readonly onBack: () => void;
  readonly onAddExpense: (name: string) => void;
  readonly onToggleFavorite: (merchant: MerchantWithStats) => void;
  readonly onRename: (merchant: MerchantWithStats) => void;
  readonly onAddAlias: (merchant: MerchantWithStats) => Promise<void>;
  readonly onRemoveAlias: (merchant: MerchantWithStats, alias: string) => void;
  readonly onArchive: (merchant: MerchantWithStats) => void;
}

/** Payee detail view: summary, aliases, history. Kept separate to keep the list view lean. */
function MerchantDetailView({
  merchant,
  favoriteKeySet,
  categoryMap,
  walletMap,
  transactions,
  hideAmount,
  onBack,
  onAddExpense,
  onToggleFavorite,
  onRename,
  onAddAlias,
  onRemoveAlias,
  onArchive,
}: MerchantDetailViewProps) {
  const { t, i18n } = useTranslation();
  const isArchived = !!merchant.archivedAt;
  const isFavorite = favoriteKeySet.has(normalizePayeeKey(merchant.displayName));
  const detailMenuItems = [
    {
      label: isFavorite ? t('payees.removeFavorite') : t('payees.addFavorite'),
      onClick: () => onToggleFavorite(merchant),
    },
    { label: t('payees.renameMerchant'), onClick: () => onRename(merchant) },
    { label: t('payees.manageAliases'), onClick: () => void onAddAlias(merchant) },
    ...(isArchived
      ? [{ label: t('payees.restoreMerchant'), onClick: () => onArchive(merchant) }]
      : [{ label: t('payees.archiveMerchant'), onClick: () => onArchive(merchant) }]
    ),
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <PageHeader
        title={merchant.displayName}
        description={
          <>
            {t('Merchant')}
            {isArchived && <span className="ml-2 text-xs italic">· {t('Archived')}</span>}
          </>
        }
        onBack={onBack}
        backLabel={t('payees.backToList')}
        actions={<CategoryOverflowMenu categoryName={merchant.displayName} items={detailMenuItems} />}
      />

      {/* Summary */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4">
        <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('All Time')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[var(--text-secondary)]">{t('payees.totalSpending')}</p>
            <p className="text-xl font-mono font-bold">{hideAmount ? '•••••' : formatCurrency(merchant.stats.totalExpense)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">{t('payees.transactionCount')}</p>
            <p className="text-xl font-mono font-bold">{merchant.stats.transactionCount} {t('Txs')}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">{t('payees.avgPerTransaction')}</p>
            <p className="text-xl font-mono font-bold">{hideAmount ? '•••••' : formatCurrency(merchant.stats.averageAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">{t('payees.lastActivity')}</p>
            <p className="text-sm font-medium">{merchant.stats.lastTransactionDate ? displayDateMedium(merchant.stats.lastTransactionDate, i18n.language) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Aliases */}
      {merchant.aliases.length > 0 && (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('payees.aliases')}</p>
          <div className="flex flex-wrap gap-2">
            {merchant.aliases.map(alias => (
              <span key={alias} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] text-xs">
                {alias}
                <button type="button" onClick={() => onRemoveAlias(merchant, alias)}
                  className="text-[var(--text-secondary)] hover:text-red-500 ml-1" aria-label={t('payees.removeAlias', { alias })}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Original name */}
      {merchant.originalName !== merchant.displayName && (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--text-secondary)]">{t('payees.originalName')}: <span className="font-medium text-[var(--text-primary)]">{merchant.originalName}</span></p>
        </div>
      )}

      {/* Add Expense CTA */}
      <button type="button" onClick={() => onAddExpense(merchant.displayName)}
        className="w-full flex items-center justify-center gap-2 h-12 bg-[var(--accent)] text-white rounded-xl font-medium hover:opacity-90 transition-colors">
        <Plus size={18} aria-hidden="true" />
        {t('payees.addExpenseFor', { name: merchant.displayName })}
      </button>

      {/* Transaction History */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold">{t('payees.transactionHistory')}</h2>
        {transactions && transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map(tx => (
              <TransactionCard key={tx.id} tx={tx} categoryMap={categoryMap} walletMap={walletMap}
                searchTerm="" hideAmount={hideAmount} isSelectionMode={false} isSelected={false}
                onSelect={() => {}} onClick={() => {}} onEdit={() => {}} onDelete={() => {}} />
            ))}
          </div>
        ) : (
          <EmptyState title={t('payees.noTransactionsYet')} description={t('payees.noTransactionsForMerchant', { name: merchant.displayName })}
            action={{ label: t('payees.addFirstExpense'), onClick: () => onAddExpense(merchant.displayName) }} />
        )}
      </div>
    </div>
  );
}

export default function PayeesView() {
  const { t, i18n } = useTranslation();
  const { hideAmount } = usePrivacy();
  const [searchParams, setSearchParams] = useSearchParams();

  // State from URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(
    searchParams.get('id') ? Number(searchParams.get('id')) : null
  );
  const [renamingMerchant, setRenamingMerchant] = useState<Merchant | null>(null);
  const [newMerchantName, setNewMerchantName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [sortConfig, setSortConfig] = useState<PayeeSortConfig>({
    field: (searchParams.get('sort') as any) ?? 'totalExpense', order: 'desc',
  });
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<PayeeFilterDraft>(EMPTY_FILTER_DRAFT);
  const [showArchived, setShowArchived] = useState(false);

  // Favorited payees (master.md 6.4) — normalized keys from settings store
  const favoriteKeys = useLiveQuery(() => getFavoritePayeeKeys(), [], []);
  const favoriteKeySet = useMemo(
    () => new Set(favoriteKeys ?? []),
    [favoriteKeys]
  );

  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txInitialDescription, setTxInitialDescription] = useState<string | undefined>();

  // ── Sync merchants on mount ────────────────────────────────
  useEffect(() => { syncMerchants(); }, []);

  // ── Query data ─────────────────────────────────────────────
  const merchants = useLiveQuery(() => db.merchants.toArray(), [], []);
  const payeeStats = useLiveQuery(async () => {
    return await getPayeeStatsFromTransactions({
      transactionFilters: buildTxFilters(filterDraft),
      aggregateFilters: buildAggFilters(filterDraft),
      sort: sortConfig,
    });
  }, [sortConfig, filterDraft]);

  const categories = useLiveQuery(() => db.categories.toArray(), [], []);
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], []);

  const categoryMap = useMemo(() =>
    (categories ?? []).reduce((acc, c) => { if (c.id) { acc[c.id] = c; } return acc; }, {} as Record<number, import('../db/db').Category>),
  [categories]);

  const walletMap = useMemo(() =>
    (wallets ?? []).reduce((acc, w) => { if (w.id) { acc[w.id] = w; } return acc; }, {} as Record<number, import('../db/db').Wallet>),
  [wallets]);

  // ── Merge merchants with stats ─────────────────────────────
  const merchantStatsMap = useMemo(() => {
    const map = new Map<string, PayeeStats>();
    for (const ps of (payeeStats ?? [])) map.set(ps.key, ps);
    return map;
  }, [payeeStats]);

  const mergedMerchants = useMemo((): MerchantWithStats[] => {
    if (!merchants) return [];
    return merchants
      .filter(m => !m.mergedIntoId) // Exclude merged-away merchants
      .map(m => {
        const key = normalizePayeeKey(m.displayName);
        const stats = merchantStatsMap.get(key) ?? {
          key, name: m.displayName, totalExpense: 0, transactionCount: 0,
          averageAmount: 0, lastTransactionDate: '', mostCommonCategory: null, mostCommonWallet: 1,
        };
        return { ...m, stats };
      });
  }, [merchants, merchantStatsMap]);

  // ── Split active / archived ────────────────────────────────
  const activeMerchants = useMemo(() => {
    let list = mergedMerchants.filter(m => !m.archivedAt);
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      list = list.filter(m =>
        m.displayName.toLowerCase().includes(lower) ||
        m.originalName.toLowerCase().includes(lower) ||
        m.aliases.some(a => a.toLowerCase().includes(lower))
      );
    }
    // Sort
    const { field, order } = sortConfig;
    const dir = order === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (field === 'name') return dir * a.displayName.localeCompare(b.displayName, i18n.language);
      if (field === 'lastTransactionDate') return dir * a.stats.lastTransactionDate.localeCompare(b.stats.lastTransactionDate);
      const aVal = (a.stats as any)[field] ?? 0;
      const bVal = (b.stats as any)[field] ?? 0;
      return dir * (aVal - bVal);
    });
    return list;
  }, [mergedMerchants, searchQuery, sortConfig, i18n.language]);

  const archivedMerchants = useMemo(
    () => mergedMerchants.filter(m => m.archivedAt),
    [mergedMerchants]
  );

  // ── Active filter count ────────────────────────────────────
  const activeFilterCount = useMemo(() =>
    filterDraft.categoryIds.length + filterDraft.walletIds.length +
    (filterDraft.startDate ? 1 : 0) + (filterDraft.endDate ? 1 : 0) +
    (filterDraft.minTotalExpense ? 1 : 0) + (filterDraft.maxTotalExpense ? 1 : 0) +
    (filterDraft.minTransactionCount ? 1 : 0) + (filterDraft.maxTransactionCount ? 1 : 0),
  [filterDraft]);

  // ── Selected merchant ──────────────────────────────────────
  const selectedMerchant = useMemo(
    () => mergedMerchants.find(m => m.id === selectedMerchantId) ?? null,
    [mergedMerchants, selectedMerchantId]
  );

  const selectedTransactions = useLiveQuery(async () => {
    if (!selectedMerchant) return [];
    return filterTransactionsByPayee(selectedMerchant.displayName, buildTxFilters(filterDraft));
  }, [selectedMerchant, filterDraft]);

  // ── Effects ────────────────────────────────────────────────
  useEffect(() => {
    if (renamingMerchant && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingMerchant]);

  // ── URL state sync ─────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedMerchantId) params.set('id', String(selectedMerchantId));
    if (sortConfig.field !== 'totalExpense') params.set('sort', sortConfig.field);
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedMerchantId, sortConfig.field, setSearchParams]);

  // ── Handlers ───────────────────────────────────────────────
  const openAddExpense = useCallback((name: string) => {
    setTxInitialDescription(name);
    setIsAddTxOpen(true);
  }, []);

  const handleRename = async () => {
    if (!renamingMerchant || !newMerchantName.trim()) return;
    const trimmed = normalizePayeeName(newMerchantName);
    if (renamingMerchant.displayName === trimmed) { setRenamingMerchant(null); return; }

    // Check duplicate
    const dup = mergedMerchants.some(m => m.id !== renamingMerchant.id && m.displayName.toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.add(t('A category with this name already exists')); return; }

    await renameMerchant(renamingMerchant.id!, trimmed);
    toast.add(t('payees.renamed', { from: renamingMerchant.displayName, to: trimmed }));
    setRenamingMerchant(null);
  };

  const handleToggleFavorite = useCallback(async (merchant: MerchantWithStats) => {
    const isFav = await toggleFavoritePayee(merchant.displayName);
    toast.add(isFav
      ? t('payees.favorited', { name: merchant.displayName })
      : t('payees.unfavorited', { name: merchant.displayName }));
  }, [t]);

  const handleArchive = async (m: MerchantWithStats) => {
    if (m.archivedAt) {
      await restoreMerchant(m.id!);
      toast.add(t('payees.restored'));
      return;
    }
    const confirmed = await confirm({
      title: t('payees.archiveTitle', { name: m.displayName }),
      message: t('payees.archiveDesc'),
      confirmLabel: t('payees.archiveMerchant'),
      cancelLabel: t('Cancel'),
    });
    if (!confirmed) return;
    await archiveMerchant(m.id!);
    toast.add(t('payees.archived'));
    if (selectedMerchantId === m.id) setSelectedMerchantId(null);
  };

  // ── Rename dialog ──────────────────────────────────────────
  const renameDialog = renamingMerchant ? (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50">
      <dialog
        open
        aria-label={t('payees.renameMerchant')}
        className="bg-[var(--card)] w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4 border-0 backdrop:bg-transparent m-0"
      >
        <h2 className="text-lg font-bold">{t('payees.renameMerchant')}</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {t('payees.renameDesc', { name: renamingMerchant.displayName })}
        </p>
        <input
          ref={renameInputRef}
          type="text"
          value={newMerchantName}
          onChange={(e) => setNewMerchantName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
          aria-label={t('payees.newNameLabel')}
        />
        <div className="flex gap-3">
          <button type="button" onClick={() => setRenamingMerchant(null)} className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)]">{t('Cancel')}</button>
          <button type="button" onClick={handleRename} disabled={!newMerchantName.trim()} className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-white font-bold hover:opacity-90 disabled:opacity-50">{t('payees.renameConfirm')}</button>
        </div>
      </dialog>
    </div>
  ) : null;

  // ── Detail view ────────────────────────────────────────────
  if (selectedMerchant) {
    return (
      <>
        <MerchantDetailView
          merchant={selectedMerchant}
          favoriteKeySet={favoriteKeySet}
          categoryMap={categoryMap}
          walletMap={walletMap}
          transactions={selectedTransactions}
          hideAmount={hideAmount}
          onBack={() => setSelectedMerchantId(null)}
          onAddExpense={openAddExpense}
          onToggleFavorite={handleToggleFavorite}
          onRename={(m) => { setRenamingMerchant(m); setNewMerchantName(m.displayName); }}
          onAddAlias={async (m) => {
            const alias = window.prompt(t('payees.addAliasPrompt'));
            if (alias) { await addMerchantAlias(m.id!, alias); toast.add(t('payees.aliasAdded')); }
          }}
          onRemoveAlias={async (m, alias) => { await removeMerchantAlias(m.id!, alias); toast.add(t('payees.aliasRemoved')); }}
          onArchive={handleArchive}
        />
        {renameDialog}
        <Suspense fallback={null}>
          <TransactionFormSheet isOpen={isAddTxOpen} onClose={() => { setIsAddTxOpen(false); setTxInitialDescription(undefined); }} initialDescription={txInitialDescription} />
        </Suspense>
      </>
    );
  }

  // ── List view ──────────────────────────────────────────────
  const renderActiveMerchantsEmpty = () => {
    if (activeMerchants.length > 0) return null;
    if (!searchQuery && activeFilterCount === 0 && archivedMerchants.length === 0) {
      return (
        <EmptyState
          icon={<ShoppingBag size={48} className="opacity-20" />}
          title={t('payees.emptyTitle')}
          description={t('payees.emptyDesc')}
        />
      );
    }
    if (searchQuery || activeFilterCount > 0) {
      return (
        <div className="text-center py-12 space-y-3">
          <ShoppingBag size={32} className="mx-auto text-[var(--text-secondary)] opacity-30" aria-hidden="true" />
          <p className="text-sm text-[var(--text-secondary)]">{searchQuery ? t('payees.searchEmpty') : t('payees.filterEmpty')}</p>
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setFilterDraft(EMPTY_FILTER_DRAFT); }}
            className="text-sm text-[var(--accent)] font-medium hover:underline"
          >
            {searchQuery ? t('payees.clearSearch') : t('payees.clearFilter')}
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div className="space-y-4">
        <PageHeader title={t('payees.pageTitle')} />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} aria-hidden="true" />
          <input type="search"
            enterKeyHint="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('payees.searchPlaceholder')}
            className="w-full h-11 pl-9 pr-9 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
            aria-label={t('payees.searchLabel')} />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--bg)]"
              aria-label={t('payees.clearSearch')}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Quick sort chips (master.md 6.7) — common needs up front */}
        <ul className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 list-none" aria-label={t('payees.quickSortLabel')}>
          {QUICK_SORTS.map((opt) => {
            const isActive = sortConfig.field === opt.field && sortConfig.order === opt.order;
            return (
              <li key={opt.labelKey}>
                <button
                  type="button"
                  onClick={() => setSortConfig({ field: opt.field, order: opt.order })}
                  className={cn(
                    "shrink-0 px-3 py-2 rounded-lg border text-sm font-medium min-h-[44px] transition-colors",
                    isActive
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                      : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)]"
                  )}
                  aria-pressed={isActive}
                >
                  {t(opt.labelKey)}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Sort & Filter */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setIsFilterOpen(true)}
            className={cn("relative flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium min-h-[44px]",
              activeFilterCount > 0 ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)]"
            )}
            aria-label={activeFilterCount > 0 ? t('payees.filterActive', { count: activeFilterCount }) : t('payees.filterLabel')}
            aria-haspopup="dialog" aria-expanded={isFilterOpen}>
            <Filter size={14} aria-hidden="true" /><span>{t('payees.filterLabel')}</span>
            {activeFilterCount > 0 && <span className="ml-1 bg-white/20 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>}
          </button>
          <button type="button" onClick={() => setIsSortOpen(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)] text-sm font-medium min-h-[44px]"
            aria-label={t('payees.advancedSortLabel')} aria-haspopup="dialog" aria-expanded={isSortOpen}>
            <SortV size={14} aria-hidden="true" /><span>{t('payees.advancedSortLabel')}</span>
          </button>
        </div>

        {/* Active Merchants */}
        {renderActiveMerchantsEmpty() ? (
          renderActiveMerchantsEmpty()
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1">{t('Active Merchants')}</h2>
            {activeMerchants.map(m => (
              <MerchantCard key={m.id} merchant={m} hideAmount={hideAmount}
                isFavorite={favoriteKeySet.has(normalizePayeeKey(m.displayName))}
                onToggleFavorite={() => handleToggleFavorite(m)}
                onOpen={() => setSelectedMerchantId(m.id!)} onAddExpense={() => openAddExpense(m.displayName)} onArchive={() => handleArchive(m)} />
            ))}
          </div>
        )}

        {/* Archived */}
        {archivedMerchants.length > 0 && (
          <div className="space-y-3">
            <button type="button" onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1 hover:text-[var(--text-primary)] min-h-[44px]"
              aria-expanded={showArchived}>
              {t('Archived Merchants')} ({archivedMerchants.length})
            </button>
            {showArchived && archivedMerchants.map(m => (
              <MerchantCard key={m.id} merchant={m} hideAmount={hideAmount} isArchived
                isFavorite={favoriteKeySet.has(normalizePayeeKey(m.displayName))}
                onToggleFavorite={() => handleToggleFavorite(m)}
                onOpen={() => setSelectedMerchantId(m.id!)} onAddExpense={() => openAddExpense(m.displayName)} onArchive={() => handleArchive(m)} />
            ))}
          </div>
        )}

        <PayeeSortSheet isOpen={isSortOpen} onClose={() => setIsSortOpen(false)} sortConfig={sortConfig} onApply={setSortConfig} />
        <PayeeFilterSheet isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} draft={filterDraft} onApply={setFilterDraft} categories={categories ?? []} wallets={wallets ?? []} />
        {renameDialog}
      </div>
      <Suspense fallback={null}>
        <TransactionFormSheet isOpen={isAddTxOpen} onClose={() => { setIsAddTxOpen(false); setTxInitialDescription(undefined); }} initialDescription={txInitialDescription} />
      </Suspense>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function buildTxFilters(draft: PayeeFilterDraft): PayeeTransactionFilters | undefined {
  const has = draft.categoryIds.length > 0 || draft.walletIds.length > 0 || draft.startDate || draft.endDate;
  if (!has) return undefined;
  return {
    categoryIds: draft.categoryIds.length > 0 ? draft.categoryIds : undefined,
    walletIds: draft.walletIds.length > 0 ? draft.walletIds : undefined,
    startDate: draft.startDate || undefined,
    endDate: draft.endDate || undefined,
  };
}

function buildAggFilters(draft: PayeeFilterDraft): PayeeAggregateFilters | undefined {
  const has = draft.minTotalExpense || draft.maxTotalExpense || draft.minTransactionCount || draft.maxTransactionCount;
  if (!has) return undefined;
  return {
    minTotalExpense: draft.minTotalExpense ? Number.parseInt(draft.minTotalExpense, 10) : undefined,
    maxTotalExpense: draft.maxTotalExpense ? Number.parseInt(draft.maxTotalExpense, 10) : undefined,
    minTransactionCount: draft.minTransactionCount ? Number.parseInt(draft.minTransactionCount, 10) : undefined,
    maxTransactionCount: draft.maxTransactionCount ? Number.parseInt(draft.maxTransactionCount, 10) : undefined,
  };
}

// ── Quick sort chips (master.md 6.7) ─────────────────────────
const QUICK_SORTS: { field: PayeeSortField; order: 'asc' | 'desc'; labelKey: string }[] = [
  { field: 'totalExpense', order: 'desc', labelKey: 'payees.sortHighestSpending' },
  { field: 'lastTransactionDate', order: 'desc', labelKey: 'payees.sortMostRecent' },
  { field: 'transactionCount', order: 'desc', labelKey: 'payees.sortMostFrequent' },
  { field: 'name', order: 'asc', labelKey: 'payees.sortAlphabetical' },
];

// ── Merchant Card ─────────────────────────────────────────────
function MerchantCard({
  merchant, hideAmount, isArchived, isFavorite, onToggleFavorite, onOpen, onAddExpense, onArchive,
}: {
  readonly merchant: MerchantWithStats; readonly hideAmount: boolean; readonly isArchived?: boolean;
  readonly isFavorite?: boolean; readonly onToggleFavorite?: () => void;
  readonly onOpen: () => void; readonly onAddExpense: () => void; readonly onArchive: () => void;
}) {
  const { t } = useTranslation();
  const s = merchant.stats;
  return (
    <article className={cn("flex items-center p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl min-h-[72px]", isArchived && "opacity-70")}>
      <button type="button" onClick={onOpen}
        className="flex-1 flex items-center gap-3 min-w-0 text-left min-h-[44px] rounded-lg -ml-2 pl-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        aria-label={merchant.displayName}>
        <div className="p-2 bg-[var(--bg)] rounded-xl text-[var(--accent)] shrink-0"><ShoppingBag size={20} aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate">
            {merchant.displayName}
            {isFavorite && <Star size={12} className="inline-block ml-1 text-[var(--accent)] -mt-0.5" aria-hidden="true" />}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('Merchant')} · {s.transactionCount === 1 ? t('1 transaction') : t('{{count}} transactions', { count: s.transactionCount })}
            {isArchived && <span className="ml-1 italic">· {t('Archived')}</span>}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {hideAmount ? '•••••' : formatCurrency(s.totalExpense)}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={(e) => { e.stopPropagation(); onAddExpense(); }}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
          aria-label={t('payees.addExpenseFor', { name: merchant.displayName })}>
          <Plus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] transition-colors",
            isFavorite
              ? "text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/20"
              : "text-[var(--text-secondary)] bg-[var(--card)] hover:bg-[var(--bg)] hover:text-[var(--accent)]"
          )}
          aria-label={isFavorite ? t('payees.removeFavorite') : t('payees.addFavorite')}
          aria-pressed={isFavorite}
        >
          {isFavorite
            ? <Star size={16} aria-hidden="true" />
            : <StarOff size={16} aria-hidden="true" />}
        </button>
        <CategoryOverflowMenu categoryName={merchant.displayName} items={[
          { label: t('payees.viewTransactions'), onClick: onOpen },
          ...(onToggleFavorite ? [{ label: isFavorite ? t('payees.removeFavorite') : t('payees.addFavorite'), onClick: onToggleFavorite }] : []),
          { label: isArchived ? t('payees.restoreMerchant') : t('payees.archiveMerchant'), onClick: onArchive },
        ]} />
      </div>
    </article>
  );
}
