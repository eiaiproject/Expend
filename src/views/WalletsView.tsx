import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Wallet as WalletIcon, HelpCircle, Plus, Search, XCircle, Handshake, SortV } from 'reicon-react';
import { confirm } from '../components/ConfirmDialog';
import { toast } from '../components/Toaster';
import { deleteWalletSafely, deactivateWallet, reactivateWallet } from '../services/walletService';
import { usePrivacy } from '../contexts/PrivacyContext';
import { formatCurrency } from '../utils/formatUtils';
import { getTodayStr } from '../utils/dateUtils';
import { SPENDING_TREND_RECENT_DAYS, SPENDING_TREND_PREVIOUS_DAYS } from '../utils/constants';
import { EmptyState } from '../components/EmptyState';
import { WalletCard } from '../components/wallet/WalletCard';
import { AddWalletSheet } from '../components/wallet/AddWalletSheet';
import { EditWalletSheet } from '../components/wallet/EditWalletSheet';
import { ReconcileBalanceSheet } from '../components/wallet/ReconcileBalanceSheet';
import { TransactionFormSheet } from '../components/TransactionFormSheet';
import { PageHeader } from '../components/PageHeader';
import type { SpendingTrend } from '../types/wallet';

type SortOption = 'default' | 'name' | 'balance' | 'activity';

export default function WalletsView() {
  const { t } = useTranslation();
  const { hideAmount } = usePrivacy();

  // Sheets
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editWallet, setEditWallet] = useState<null | { id: number; name: string; color?: string }>(null);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [reconcileWallet, setReconcileWallet] = useState<null | { id: number; name: string; currentBalance: number; initialBalance: number }>(null);

  // Transfer state
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferFromWalletId, setTransferFromWalletId] = useState<number | null>(null);

  // Help
  const [showHelp, setShowHelp] = useState(false);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Data
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], undefined);
  const isLoading = wallets === undefined;

  // Spending trends — single query for all wallets
  const spendingTrends = useLiveQuery(computeSpendingTrends, [wallets], {} as Record<number, SpendingTrend>);

  async function computeSpendingTrends(): Promise<Record<number, SpendingTrend>> {
    const walletIds = wallets?.map(w => w.id!).filter(Boolean) ?? [];
    if (!wallets || wallets.length === 0 || walletIds.length === 0) return {};

    const now = new Date();
    const todayStr = getTodayStr(now);
    const recentDaysAgoStr = getTodayStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - SPENDING_TREND_RECENT_DAYS));
    const previousDaysAgoStr = getTodayStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - SPENDING_TREND_PREVIOUS_DAYS));

    const txs = await db.transactions
      .where('walletId')
      .anyOf(walletIds)
      .and(t => t.date >= previousDaysAgoStr)
      .toArray();

    const result: Record<number, SpendingTrend> = {};

    for (const walletId of walletIds) {
      const walletTxs = txs.filter(t => t.walletId === walletId);
      const { recentSpent, previousSpent } = computeWalletSpending(walletTxs, todayStr, recentDaysAgoStr, previousDaysAgoStr);

      if (previousSpent === 0) {
        result[walletId] = null;
      } else {
        const change = ((recentSpent - previousSpent) / previousSpent) * 100;
        result[walletId] = { recentSpent, previousSpent, change, isUp: change > 0 };
      }
    }

    return result;
  }

  const lastActivityDates = useLiveQuery(
    computeLastActivityDates,
    [wallets],
    {} as Record<number, string | null>
  );

  async function computeLastActivityDates(): Promise<Record<number, string | null>> {
    if (!wallets || wallets.length === 0) return {};

    const walletIds = wallets.map(w => w.id!).filter(Boolean);
    if (walletIds.length === 0) return {};

    const txs = await db.transactions
      .where('walletId')
      .anyOf(walletIds)
      .reverse()
      .sortBy('date');

    const result: Record<number, string | null> = {};
    for (const walletId of walletIds) {
      const lastTx = txs.find(t => t.walletId === walletId);
      result[walletId] = lastTx?.date ?? null;
    }
    return result;
  }

  // Split wallets into active / inactive
  const { activeWallets, inactiveWallets } = useMemo(() => {
    if (!wallets) return { activeWallets: [], inactiveWallets: [] };
    const active = wallets.filter(w => !w.archivedAt);
    const inactive = wallets.filter(w => !!w.archivedAt);
    return { activeWallets: active, inactiveWallets: inactive };
  }, [wallets]);

  // Sort wallets
  const sortWallets = useCallback((list: typeof activeWallets) => {
    if (sortBy === 'default') return list;

    const sorted = [...list];
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'balance':
        return sorted.sort((a, b) => (b.currentBalance ?? b.initialBalance) - (a.currentBalance ?? a.initialBalance));
      case 'activity':
        return sorted.sort((a, b) => {
          const aDate = lastActivityDates?.[a.id!] ?? a.lastUpdated;
          const bDate = lastActivityDates?.[b.id!] ?? b.lastUpdated;
          return bDate.localeCompare(aDate);
        });
      default:
        return sorted;
    }
  }, [sortBy, lastActivityDates]);

  // Filter by search
  const filteredActive = useMemo(() => {
    let list = activeWallets;
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(w => w.name.toLowerCase().includes(term));
    }
    return sortWallets(list);
  }, [activeWallets, searchTerm, sortWallets]);

  const filteredInactive = useMemo(() => {
    if (!searchTerm.trim()) return inactiveWallets;
    const term = searchTerm.trim().toLowerCase();
    return inactiveWallets.filter(w => w.name.toLowerCase().includes(term));
  }, [inactiveWallets, searchTerm]);

  // Total balance of active wallets only
  const totalBalance = useMemo(() => {
    return activeWallets.reduce((sum, w) => sum + (w.currentBalance ?? w.initialBalance), 0);
  }, [activeWallets]);

  // Handlers
  const handleEdit = useCallback((wallet: { readonly id: number; name: string; color?: string }) => {
    setEditWallet(wallet);
    setIsEditOpen(true);
  }, []);

  const handleReconcile = useCallback((wallet: { readonly id: number; name: string; currentBalance: number; initialBalance: number }) => {
    setReconcileWallet(wallet);
    setIsReconcileOpen(true);
  }, []);

  const handleTransfer = useCallback((walletId: number) => {
    setTransferFromWalletId(walletId);
    setIsTransferOpen(true);
  }, []);

  const handleDeactivate = useCallback(async (wallet: { readonly id: number; name: string }) => {
    const confirmed = await confirm({
      title: t('wallet.deactivateTitle', { name: wallet.name }),
      message: t('wallet.deactivateDesc'),
      confirmLabel: t('wallet.deactivateCta'),
    });
    if (!confirmed) return;
    try {
      await deactivateWallet(wallet.id);
      toast.add(t('wallet.deactivated'));
    } catch {
      toast.add(t('wallet.reconcileError'));
    }
  }, [t]);

  const handleReactivate = useCallback(async (wallet: { readonly id: number; name: string }) => {
    try {
      await reactivateWallet(wallet.id);
      toast.add(t('wallet.reactivated'));
    } catch {
      toast.add(t('wallet.reconcileError'));
    }
  }, [t]);

  const handleDelete = useCallback(async (wallet: { readonly id: number; name: string }) => {
    const confirmed = await confirm({
      title: t('wallet.deleteTitle', { name: wallet.name }),
      message: t('wallet.deleteDesc'),
      confirmLabel: t('wallet.deleteCta'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      const result = await deleteWalletSafely(wallet.id);
      if (!result.success) {
        toast.add(result.reasonKey ? t(result.reasonKey, result.reasonOptions) : t('wallet.deleteError'));
      } else {
        toast.add(t('wallet.deleteSuccess'));
      }
    } catch {
      toast.add(t('wallet.deleteError'));
    }
  }, [t]);

  const sortLabel = useMemo(() => {
    switch (sortBy) {
      case 'name': return t('wallet.sortName');
      case 'balance': return t('wallet.sortBalance');
      case 'activity': return t('wallet.sortActivity');
      default: return t('wallet.sortDefault');
    }
  }, [sortBy, t]);

  // ── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label={t('Loading...')}> {/* NOSONAR: S6819 */}
        <div className="h-8 w-32 bg-[var(--card)] rounded-lg animate-pulse" />
        <div className="h-4 w-48 bg-[var(--card)] rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={`skel-${i}`} className="h-28 bg-[var(--card)] rounded-[16px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state (no wallets at all) ──────────────────────────
  if (wallets?.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('Wallets')}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                aria-label={t('wallet.helpLabel')}
                aria-pressed={showHelp}
              >
                <HelpCircle size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-white px-4 shadow transition-colors hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                aria-label={t('wallet.addLabel')}
              >
                <Plus size={18} aria-hidden="true" />
                <span className="text-sm font-semibold hidden sm:inline">{t('wallet.addLabel')}</span>
              </button>
            </div>
          }
        />
        {showHelp && <HelpPanel t={t} />}
        <EmptyState
          icon={<WalletIcon size={48} className="opacity-20" />}
          title={t('wallet.emptyTitle')}
          description={t('wallet.emptyDesc')}
          action={{
            label: t('wallet.emptyCta'),
            onClick: () => setIsAddOpen(true),
          }}
        />
        <AddWalletSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      </div>
    );
  }

  // ── Main content ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Wallets')}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              aria-label={t('wallet.helpLabel')}
              aria-pressed={showHelp}
            >
              <HelpCircle size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-white px-4 shadow transition-colors hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              aria-label={t('wallet.addLabel')}
            >
              <Plus size={18} aria-hidden="true" />
              <span className="text-sm font-semibold hidden sm:inline">{t('wallet.addLabel')}</span>
            </button>
          </div>
        }
      />

      {showHelp && <HelpPanel t={t} />}

      {/* Summary — only if there are active wallets */}
      {activeWallets.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {t('wallet.activeCount', { count: activeWallets.length })}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('wallet.totalBalance')}: {hideAmount ? '•••••' : formatCurrency(totalBalance)}
          </p>
        </div>
      )}

      {/* All wallets inactive state */}
      {activeWallets.length === 0 && inactiveWallets.length > 0 && !searchTerm && (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <p className="text-sm font-medium">{t('wallet.activeCountZero')}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {t('wallet.emptyDesc')}
          </p>
        </div>
      )}

      {/* Search + Sort — progressive: show when > 3 wallets */}
      {(activeWallets.length + inactiveWallets.length) > 3 && (
        <div className="flex gap-2">
          <search role="search" aria-label={t('wallet.searchPh')} className="flex-1">
            <label htmlFor="wallet-search" className="sr-only">{t('wallet.searchPh')}</label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={18} aria-hidden="true" />
              <input
                id="wallet-search"
                type="search"
            enterKeyHint="search"
                name="walletSearch"
                autoComplete="off"
                placeholder={t('wallet.searchPh')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] placeholder:text-[var(--text-secondary)]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors -mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                  aria-label={t('wallet.emptySearchClear')}
                >
                  <XCircle size={18} />
                </button>
              )}
            </div>
          </search>

          {/* Sort button */}
          <button
            type="button"
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 shrink-0"
            aria-label={t('wallet.sortLabel') + ': ' + sortLabel}
            aria-haspopup="listbox"
            aria-expanded={isSortOpen}
          >
            <SortV size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Sort dropdown */}
      {isSortOpen && (
        <select
          size={4}
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden w-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
          aria-label={t('wallet.sortLabel')}
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value as SortOption); setIsSortOpen(false); }}
          onBlur={() => setIsSortOpen(false)}
        >
          {([
            { value: 'default', label: t('wallet.sortDefault') },
            { value: 'name', label: t('wallet.sortName') },
            { value: 'balance', label: t('wallet.sortBalance') },
            { value: 'activity', label: t('wallet.sortActivity') },
          ] as const).map((option) => (
            <option
              key={option.value}
              value={option.value}
              className={`${
                sortBy === option.value
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
                  : ''
              }`}
            >
              {option.label}
            </option>
          ))}
        </select>
      )}

      {/* Active wallets */}
      {filteredActive.length > 0 && (
        <section aria-labelledby="wallets-active">
          <h2 id="wallets-active" className="sticky top-0 z-10 bg-[var(--bg)] pt-1 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            {t('wallet.sectionActive')}
          </h2>
          <div className="space-y-3">
            {filteredActive.map(wallet => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                balance={wallet.currentBalance ?? wallet.initialBalance}
                spendingTrend={spendingTrends?.[wallet.id!] ?? null}
                lastActivityDate={lastActivityDates?.[wallet.id!] ?? null}
                onEdit={() => handleEdit({ id: wallet.id!, name: wallet.name, color: wallet.color })}
                onTransfer={() => handleTransfer(wallet.id!)}
                onReconcile={() => handleReconcile({
                  id: wallet.id!,
                  name: wallet.name,
                  currentBalance: wallet.currentBalance ?? wallet.initialBalance,
                  initialBalance: wallet.initialBalance,
                })}
                onDeactivate={() => handleDeactivate({ id: wallet.id!, name: wallet.name })}
                onReactivate={() => handleReactivate({ id: wallet.id!, name: wallet.name })}
                onDelete={() => handleDelete({ id: wallet.id!, name: wallet.name })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Inactive wallets — collapsible */}
      {filteredInactive.length > 0 && (
        <section aria-labelledby="wallets-inactive">
          <h2 id="wallets-inactive" className="sticky top-0 z-10 bg-[var(--bg)] pt-1 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            {t('wallet.sectionInactive')} ({t('wallet.inactiveCount', { count: filteredInactive.length })})
          </h2>
          <div className="space-y-3">
            {filteredInactive.map(wallet => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                balance={wallet.currentBalance ?? wallet.initialBalance}
                spendingTrend={spendingTrends?.[wallet.id!] ?? null}
                lastActivityDate={lastActivityDates?.[wallet.id!] ?? null}
                onEdit={() => handleEdit({ id: wallet.id!, name: wallet.name, color: wallet.color })}
                onTransfer={() => handleTransfer(wallet.id!)}
                onReconcile={() => handleReconcile({
                  id: wallet.id!,
                  name: wallet.name,
                  currentBalance: wallet.currentBalance ?? wallet.initialBalance,
                  initialBalance: wallet.initialBalance,
                })}
                onDeactivate={() => handleDeactivate({ id: wallet.id!, name: wallet.name })}
                onReactivate={() => handleReactivate({ id: wallet.id!, name: wallet.name })}
                onDelete={() => handleDelete({ id: wallet.id!, name: wallet.name })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Search empty state */}
      {searchTerm && filteredActive.length === 0 && filteredInactive.length === 0 && (
        <EmptyState
          title={t('wallet.emptySearchTitle')}
          description=""
          action={{
            label: t('wallet.emptySearchClear'),
            onClick: () => setSearchTerm(''),
          }}
        />
      )}

      {/* Debt link — secondary, after wallet list */}
      <Link
        to="/debts"
        className="block rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
            <Handshake size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--text-secondary)]">{t('wallet.debtLinkText')}</p>
          </div>
          <span className="shrink-0 text-xs font-bold text-[var(--accent)]">{t('wallet.debtLinkCta')}</span>
        </div>
      </Link>

      {/* Sheets */}
      <AddWalletSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />

      {editWallet && (
        <EditWalletSheet
          isOpen={isEditOpen}
          onClose={() => { setIsEditOpen(false); setEditWallet(null); }}
          wallet={{
            id: editWallet.id,
            name: editWallet.name,
            currency: 'IDR',
            lastUpdated: '',
            initialBalance: 0,
            currentBalance: 0,
            color: editWallet.color,
          }}
        />
      )}

      {reconcileWallet && (
        <ReconcileBalanceSheet
          isOpen={isReconcileOpen}
          onClose={() => { setIsReconcileOpen(false); setReconcileWallet(null); }}
          wallet={{
            id: reconcileWallet.id,
            name: reconcileWallet.name,
            currency: 'IDR',
            lastUpdated: '',
            initialBalance: reconcileWallet.initialBalance,
            currentBalance: reconcileWallet.currentBalance,
          }}
        />
      )}

      {/* Transfer form — opens TransactionFormSheet with transfer type and pre-selected wallet */}
      {isTransferOpen && transferFromWalletId && (
        <TransferFormWrapper
          isOpen={isTransferOpen}
          onClose={() => { setIsTransferOpen(false); setTransferFromWalletId(null); }}
          fromWalletId={transferFromWalletId}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function computeWalletSpending(
  walletTxs: { amount: number; type: string; date: string }[],
  todayStr: string,
  recentDaysAgoStr: string,
  previousDaysAgoStr: string
): { recentSpent: number; previousSpent: number } {
  let recentSpent = 0;
  let previousSpent = 0;

  for (const tx of walletTxs) {
    if (tx.type !== 'expense' && tx.type !== 'transfer_out') continue;
    const txDate = tx.date.split('T')[0]!;
    if (txDate >= recentDaysAgoStr && txDate <= todayStr) {
      recentSpent += tx.amount;
    } else if (txDate >= previousDaysAgoStr && txDate < recentDaysAgoStr) {
      previousSpent += tx.amount;
    }
  }

  return { recentSpent, previousSpent };
}

function HelpPanel({ t }: { readonly t: (key: string) => string }) {
  return (
    <div className="rounded-[16px] border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4" role="region" aria-label={t('wallet.helpTitle')}> {/* NOSONAR: S6819 — landmark region */}
      <h2 className="font-bold text-[var(--accent)] mb-2">{t('wallet.helpTitle')}</h2>
      <ul className="text-sm text-[var(--text-secondary)] space-y-1 list-disc list-inside">
        <li>{t('wallet.helpBullet1')}</li>
        <li>{t('wallet.helpBullet2')}</li>
        <li>{t('wallet.helpBullet3')}</li>
        <li>{t('wallet.helpBullet4')}</li>
        <li>{t('wallet.helpBullet5')}</li>
      </ul>
    </div>
  );
}

/**
 * Wrapper that opens TransactionFormSheet with transfer type and pre-selected source wallet.
 */
function TransferFormWrapper({ isOpen, onClose, fromWalletId }: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly fromWalletId: number;
}) {
  return (
    <TransactionFormSheet
      isOpen={isOpen}
      onClose={onClose}
      initialType="transfer"
      initialFromWalletId={fromWalletId}
    />
  );
}
