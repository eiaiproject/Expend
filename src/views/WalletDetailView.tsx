import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction } from '../db/db';
import { ArrowLeft, Wallet as WalletIcon, TrendingUp, TrendingDown, ArrowRightLeft, AlertCircle, ArrowDownRight, ArrowUpRight, Scale } from 'lucide-react';
import { usePrivacy } from '../contexts/PrivacyContext';
import { formatCurrency, formatSignedCurrency } from '../utils/formatUtils';
import { displayDateMedium } from '../utils/dateUtils';
import { daysBetweenDateOnly, getTodayStr, getYesterdayStr, getWeekStartStr, normaliseDate } from '../utils/dateUtils';
import { WALLET_STALE_DAYS } from '../utils/constants';
import { EmptyState } from '../components/EmptyState';
import { TransactionDetailSheet } from '../components/TransactionDetailSheet';
import { Skeleton } from '../components/Skeleton';

export default function WalletDetailView() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { hideAmount } = usePrivacy();
  const navigate = useNavigate();

  const walletId = parseInt(id || '0', 10);

  // Wallet data
  const wallet = useLiveQuery(() => db.wallets.get(walletId), [walletId], undefined);
  const transactions = useLiveQuery(
    () => db.transactions.where('walletId').equals(walletId).reverse().sortBy('date'),
    [walletId],
    undefined,
  );
  const categories = useLiveQuery(() => db.categories.toArray(), [], undefined);

  // Loading state
  if (wallet === undefined || transactions === undefined || categories === undefined) {
    return (
      <div className="space-y-4" role="status" aria-label={t('Loading...')}>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-24 rounded-[16px]" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 rounded-[16px]" />
          ))}
        </div>
      </div>
    );
  }

  // Not found
  if (!wallet) {
    return (
      <div className="space-y-4">
        <Link
          to="/wallets"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('Wallets')}
        </Link>
        <EmptyState
          icon={<WalletIcon size={48} className="opacity-20" />}
          title={t('Wallet not found')}
          description={t('The wallet you are looking for does not exist.')}
          action={{
            label: t('wallet.emptyCta'),
            onClick: () => navigate('/wallets'),
          }}
        />
      </div>
    );
  }

  const balance = wallet.currentBalance ?? wallet.initialBalance;
  const isStale = daysBetweenDateOnly(new Date(), wallet.lastUpdated) >= WALLET_STALE_DAYS;
  const staleDays = daysBetweenDateOnly(new Date(), wallet.lastUpdated);
  const isArchived = !!wallet.archivedAt;

  // Category map
  const categoryMap = useMemo(() => {
    if (!categories) return {};
    return categories.reduce((acc, cat) => {
      if (cat.id != null) acc[cat.id] = cat as { id: number; name: string; icon: string; color: string };
      return acc;
    }, {} as Record<number, { id: number; name: string; icon: string; color: string }>);
  }, [categories]);

  // Group transactions by period
  const groupedTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();
    const weekStartStr = getWeekStartStr();

    const groups: { labelKey: string; count: number; transactions: Transaction[] }[] = [];

    const todayTxs: Transaction[] = [];
    const yesterdayTxs: Transaction[] = [];
    const weekTxs: Transaction[] = [];
    const earlierTxs: Transaction[] = [];

    for (const tx of transactions) {
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
  }, [transactions]);

  // Selected transaction for detail sheet
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Format transaction for display
  const formatTxAmount = useCallback((tx: Transaction) => {
    if (tx.type === 'expense') {
      return `-${formatCurrency(tx.amount, hideAmount)}`;
    } else if (tx.type === 'transfer_out') {
      return `-${formatCurrency(tx.amount, hideAmount)}`;
    } else if (tx.type === 'transfer_in') {
      return `+${formatCurrency(tx.amount, hideAmount)}`;
    } else if (tx.type === 'balance_adjustment') {
      return formatSignedCurrency(tx.amount, hideAmount);
    }
    return formatCurrency(tx.amount, hideAmount);
  }, [hideAmount]);

  const getTxTypeLabel = useCallback((tx: Transaction) => {
    if (tx.type === 'expense') return t('home.typeExpense');
    if (tx.type === 'transfer_in') return t('wallet.detailTransferIn');
    if (tx.type === 'transfer_out') return t('wallet.detailTransferOut');
    if (tx.type === 'balance_adjustment') return t('wallet.detailAdjustment');
    return tx.type;
  }, [t]);

  const getTxTypeColor = useCallback((tx: Transaction) => {
    if (tx.type === 'expense') return 'text-red-500';
    if (tx.type === 'transfer_out') return 'text-amber-500';
    if (tx.type === 'transfer_in') return 'text-green-500';
    if (tx.type === 'balance_adjustment') {
      return tx.amount >= 0 ? 'text-green-500' : 'text-red-500';
    }
    return 'text-[var(--text-primary)]';
  }, []);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/wallets"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:rounded-lg"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t('Wallets')}
      </Link>

      {/* Wallet header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl shrink-0" style={{ backgroundColor: wallet.color ? `${wallet.color}15` : undefined }}>
          <WalletIcon size={32} style={{ color: wallet.color || 'var(--accent)' }} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate" style={{ fontFamily: 'var(--font-display)' }}>
            {wallet.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[var(--text-secondary)]">
              {wallet.currency}
            </span>
            {isStale && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] font-semibold rounded">
                <AlertCircle size={10} aria-hidden="true" />
                {staleDays}d {t('stale')}
              </span>
            )}
            {isArchived && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-[var(--bg)] text-[var(--text-secondary)] text-[10px] font-semibold rounded">
                {t('Inactive')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Balance */}
      <div className="bg-[var(--card)] rounded-[16px] p-5 border border-[var(--border)]">
        <p className="text-sm text-[var(--text-secondary)] mb-1">{t('wallet.balanceLabel')}</p>
        <p
          className="font-mono text-3xl font-bold"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {hideAmount ? '•••••' : formatCurrency(balance)}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-2">
          {t('wallet.lastActivity')}: {displayDateMedium(wallet.lastUpdated, i18n.language)}
        </p>
      </div>

      {/* Transactions */}
      <section aria-labelledby="wallet-transactions">
        <h2 id="wallet-transactions" className="text-lg font-bold mb-4">
          {t('wallet.detailRecentTxs')}
        </h2>

        {transactions.length === 0 ? (
          <EmptyState
            title={t('wallet.detailNoTxs')}
            description={t('home.emptyDescription')}
          />
        ) : (
          <div className="space-y-6">
            {groupedTransactions.map(group => {
              const groupId = group.labelKey.replace('home.group', '').toLowerCase();
              return (
                <section key={group.labelKey} aria-labelledby={`wallet-tx-group-${groupId}`}>
                  <h3
                    id={`wallet-tx-group-${groupId}`}
                    className="sticky top-0 z-10 bg-[var(--bg)] pt-1 pb-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider"
                  >
                    {t(group.labelKey, { count: group.count })}
                  </h3>
                  <div className="space-y-2">
                    {group.transactions.map(tx => (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => setSelectedTx(tx)}
                        className="w-full flex items-center gap-3 p-3 bg-[var(--card)] rounded-xl border border-[var(--border)] text-left hover:border-[var(--accent)]/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[var(--bg)] flex items-center justify-center shrink-0">
                          {tx.type === 'transfer_in' ? <ArrowUpRight size={18} className="text-green-500" /> : tx.type === 'transfer_out' ? <ArrowDownRight size={18} className="text-amber-500" /> : tx.type === 'balance_adjustment' ? <Scale size={18} className="text-[var(--accent)]" /> : <span className="text-sm font-bold" style={{ color: categoryMap[tx.categoryId!]?.color || 'var(--text-secondary)' }}>{categoryMap[tx.categoryId!]?.name?.charAt(0) || 'T'}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{tx.description}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {getTxTypeLabel(tx)}
                          </p>
                        </div>
                        <span className={`font-mono font-bold shrink-0 ${getTxTypeColor(tx)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatTxAmount(tx)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      {/* Transaction detail sheet */}
      <TransactionDetailSheet
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
        onEdit={() => {}}
        onDelete={() => {}}
        onRepeat={() => {}}
      />
    </div>
  );
}
