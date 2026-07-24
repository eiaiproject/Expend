import React, { useState, useMemo, useRef, useEffect, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Merchant } from '../db/db';
import {
  Search, ArrowLeft, ShoppingBag, Plus, X, Filter, SortV
} from 'reicon-react';
import { cn } from '../utils/cn';
import { formatCurrency } from '../utils/formatUtils';
import { displayDateMedium } from '../utils/dateUtils';
import { usePrivacy } from '../contexts/PrivacyContext';
import { confirm } from '../components/ConfirmDialog';
import {
  getPayeeStatsFromTransactions, filterTransactionsByPayee,
  normalizePayeeKey, normalizePayeeName,
  type PayeeStats, type PayeeSortConfig, type PayeeTransactionFilters, type PayeeAggregateFilters
} from '../services/payeeService';
import {
  ensureMerchant, renameMerchant, addMerchantAlias, removeMerchantAlias,
  archiveMerchant, restoreMerchant, syncMerchants
} from '../services/merchantService';
import { TransactionCard } from '../components/home/TransactionCard';
import { EmptyState } from '../components/EmptyState';
import { toast } from '../components/Toaster';
import { PayeeSortSheet } from '../components/PayeeSortSheet';
import { PayeeFilterSheet, type PayeeFilterDraft } from '../components/PayeeFilterSheet';
import { CategoryOverflowMenu } from '../components/categories/CategoryOverflowMenu';
import { useSearchParams } from 'react-router-dom';

const TransactionFormSheet = lazy(() => import('../components/TransactionFormSheet').then(m => ({ default: m.TransactionFormSheet })));

const EMPTY_FILTER_DRAFT: PayeeFilterDraft = {
  categoryIds: [], walletIds: [], startDate: '', endDate: '',
  minTotalExpense: '', maxTotalExpense: '', minTransactionCount: '', maxTransactionCount: '',
};

// ── Enriched merchant with stats ─────────────────────────────
interface MerchantWithStats extends Merchant {
  readonly stats: PayeeStats;
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
    // NOSONAR S6819 — <dialog> would break custom styling
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-label={t('payees.renameMerchant')}>
      <div className="bg-[var(--card)] w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
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
      </div>
    </div>
  ) : null;

  // ── Detail view ────────────────────────────────────────────
  if (selectedMerchant) {
    const m = selectedMerchant;
    const isArchived = !!m.archivedAt;
    const detailMenuItems = [
      { label: t('payees.renameMerchant'), onClick: () => { setRenamingMerchant(m); setNewMerchantName(m.displayName); } },
      { label: t('payees.manageAliases'), onClick: async () => {
        const alias = window.prompt(t('payees.addAliasPrompt'));
        if (alias) { await addMerchantAlias(m.id!, alias); toast.add(t('payees.aliasAdded')); }
      }},
      ...(isArchived
        ? [{ label: t('payees.restoreMerchant'), onClick: () => handleArchive(m) }]
        : [{ label: t('payees.archiveMerchant'), onClick: () => handleArchive(m) }]
      ),
    ];

    return (
      <>
        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSelectedMerchantId(null)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              aria-label={t('payees.backToList')}
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{m.displayName}</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {t('Merchant')}{isArchived && <span className="ml-2 text-xs italic">· {t('Archived')}</span>}
              </p>
            </div>
            <CategoryOverflowMenu categoryName={m.displayName} items={detailMenuItems} />
          </div>

          {/* Summary */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{t('All Time')}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{t('payees.totalSpending')}</p>
                <p className="text-xl font-mono font-bold">{hideAmount ? '•••••' : formatCurrency(m.stats.totalExpense)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{t('payees.transactionCount')}</p>
                <p className="text-xl font-mono font-bold">{m.stats.transactionCount} {t('Txs')}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{t('payees.avgPerTransaction')}</p>
                <p className="text-xl font-mono font-bold">{hideAmount ? '•••••' : formatCurrency(m.stats.averageAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">{t('payees.lastActivity')}</p>
                <p className="text-sm font-medium">{m.stats.lastTransactionDate ? displayDateMedium(m.stats.lastTransactionDate, i18n.language) : '—'}</p>
              </div>
            </div>
          </div>

          {/* Aliases */}
          {m.aliases.length > 0 && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4">
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('payees.aliases')}</p>
              <div className="flex flex-wrap gap-2">
                {m.aliases.map(alias => (
                  <span key={alias} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] text-xs">
                    {alias}
                    <button type="button" onClick={async () => { await removeMerchantAlias(m.id!, alias); toast.add(t('payees.aliasRemoved')); }}
                      className="text-[var(--text-secondary)] hover:text-red-500 ml-1" aria-label={t('payees.removeAlias', { alias })}>
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Original name */}
          {m.originalName !== m.displayName && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">{t('payees.originalName')}: <span className="font-medium text-[var(--text-primary)]">{m.originalName}</span></p>
            </div>
          )}

          {/* Add Expense CTA */}
          <button type="button" onClick={() => openAddExpense(m.displayName)}
            className="w-full flex items-center justify-center gap-2 h-12 bg-[var(--accent)] text-white rounded-xl font-medium hover:opacity-90 transition-colors">
            <Plus size={18} aria-hidden="true" />
            {t('payees.addExpenseFor', { name: m.displayName })}
          </button>

          {/* Transaction History */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold">{t('payees.transactionHistory')}</h2>
            {selectedTransactions && selectedTransactions.length > 0 ? (
              <div className="space-y-2">
                {selectedTransactions.map(tx => (
                  <TransactionCard key={tx.id} tx={tx} categoryMap={categoryMap} walletMap={walletMap}
                    searchTerm="" hideAmount={hideAmount} isSelectionMode={false} isSelected={false}
                    onSelect={() => {}} onClick={() => {}} onEdit={() => {}} onDelete={() => {}} />
                ))}
              </div>
            ) : (
              <EmptyState title={t('payees.noTransactionsYet')} description={t('payees.noTransactionsForMerchant', { name: m.displayName })}
                action={{ label: t('payees.addFirstExpense'), onClick: () => openAddExpense(m.displayName) }} />
            )}
          </div>
        </div>
        {renameDialog}
        <Suspense fallback={null}>
          <TransactionFormSheet isOpen={isAddTxOpen} onClose={() => { setIsAddTxOpen(false); setTxInitialDescription(undefined); }} initialDescription={txInitialDescription} />
        </Suspense>
      </>
    );
  }

  // ── List view ──────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">
        <h1 className="text-xl font-bold">{t('payees.pageTitle')}</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} aria-hidden="true" />
          <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
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
            aria-label={t('payees.sortLabel')} aria-haspopup="dialog" aria-expanded={isSortOpen}>
            <SortV size={14} aria-hidden="true" /><span>{t('payees.sortLabel')}</span>
          </button>
        </div>

        {/* Active Merchants */}
        {activeMerchants.length === 0 && !searchQuery && activeFilterCount === 0 && archivedMerchants.length === 0 ? (
          <EmptyState icon={<ShoppingBag size={48} className="opacity-20" />} title={t('payees.emptyTitle')} description={t('payees.emptyDesc')} />
        ) : activeMerchants.length === 0 && (searchQuery || activeFilterCount > 0) ? (
          <div className="text-center py-12 space-y-3">
            <ShoppingBag size={32} className="mx-auto text-[var(--text-secondary)] opacity-30" aria-hidden="true" />
            <p className="text-sm text-[var(--text-secondary)]">{searchQuery ? t('payees.searchEmpty') : t('payees.filterEmpty')}</p>
            <button type="button" onClick={() => { setSearchQuery(''); setFilterDraft(EMPTY_FILTER_DRAFT); }} className="text-sm text-[var(--accent)] font-medium hover:underline">
              {searchQuery ? t('payees.clearSearch') : t('payees.clearFilter')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1">{t('Active Merchants')}</h2>
            {activeMerchants.map(m => (
              <MerchantCard key={m.id} merchant={m} hideAmount={hideAmount}
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

// ── Merchant Card ─────────────────────────────────────────────
function MerchantCard({
  merchant, hideAmount, isArchived, onOpen, onAddExpense, onArchive,
}: {
  merchant: MerchantWithStats; hideAmount: boolean; isArchived?: boolean;
  onOpen: () => void; onAddExpense: () => void; onArchive: () => void;
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
          <p className="font-bold text-sm truncate">{merchant.displayName}</p>
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
        <CategoryOverflowMenu categoryName={merchant.displayName} items={[
          { label: t('payees.viewTransactions'), onClick: onOpen },
          { label: isArchived ? t('payees.restoreMerchant') : t('payees.archiveMerchant'), onClick: onArchive },
        ]} />
      </div>
    </article>
  );
}
