import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet as WalletIcon, AlertCircle, TrendUp, TrendDown } from 'reicon-react';
import { Link } from 'react-router-dom';
import type { Wallet } from '../../db/db';
import type { SpendingTrend } from '../../types/wallet';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { formatCurrency } from '../../utils/formatUtils';
import { displayDateMedium, daysBetweenDateOnly } from '../../utils/dateUtils';
import { WALLET_STALE_DAYS } from '../../utils/constants';
import { WalletOverflowMenu } from './WalletOverflowMenu';

interface WalletCardProps {
  wallet: Wallet;
  balance: number;
  spendingTrend: SpendingTrend;
  lastActivityDate?: string | null;
  onEdit: () => void;
  onTransfer: () => void;
  onReconcile: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}

/**
 * Semantic wallet card.
 *
 * Structure:
 * <article>
 *   <Link to="/wallets/:id"> — main card area (name, last activity, balance)
 *   <WalletOverflowMenu> — sibling button (not nested inside Link)
 * </article>
 *
 * Follows W3C pattern for composite widgets.
 * No nested interactive elements.
 * Privacy mode hides all amounts.
 */
export function WalletCard({
  wallet,
  balance,
  spendingTrend,
  lastActivityDate,
  onEdit,
  onTransfer,
  onReconcile,
  onDeactivate,
  onReactivate,
  onDelete,
}: WalletCardProps) {
  const { t, i18n } = useTranslation();
  const { hideAmount } = usePrivacy();

  const isStale = daysBetweenDateOnly(new Date(), wallet.lastUpdated) >= WALLET_STALE_DAYS;
  const staleDays = daysBetweenDateOnly(new Date(), wallet.lastUpdated);
  const isArchived = !!wallet.archivedAt;

  // Format last activity — show "No activity yet" if no date
  const lastActivityDisplay = useMemo(() => {
    if (!lastActivityDate) return t('wallet.noActivity');
    return displayDateMedium(lastActivityDate, i18n.language);
  }, [lastActivityDate, i18n.language, t]);

  // Accessible name: wallet name + balance (privacy-aware)
  const accessibleName = useMemo(() => {
    const balanceText = hideAmount ? t('wallet.amountHidden') : formatCurrency(balance);
    return `${wallet.name}, ${t('wallet.balanceLabel')}: ${balanceText}`;
  }, [wallet.name, balance, hideAmount, t]);

  return (
    <article
      data-testid="wallet-card"
      data-wallet-card={wallet.name}
      className={`bg-[var(--card)] rounded-[16px] p-5 shadow-sm border transition-colors ${
        isArchived
          ? 'border-[var(--border)] opacity-70'
          : isStale
            ? 'border-amber-500/30'
            : 'border-[var(--border)] hover:border-[var(--accent)]/30'
      }`}
    >
      <div className="flex justify-between items-start gap-3">
        {/* Main card area — Link to wallet detail */}
        <Link
          to={`/wallets/${wallet.id}`}
          className="flex items-center gap-3 min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:rounded-lg -m-1 p-1"
          aria-label={accessibleName}
        >
          <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: wallet.color ? `${wallet.color}15` : undefined }}>
            <WalletIcon size={24} style={{ color: wallet.color || 'var(--accent)' }} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold truncate">{wallet.name}</h3>
            <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
              <span>{lastActivityDisplay}</span>
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
            </p>
          </div>
        </Link>

        {/* Overflow menu — sibling of Link, not nested */}
        <WalletOverflowMenu
          wallet={wallet}
          onViewTransactions={() => {
            // Navigate to home with wallet filter
            window.location.href = `/?wallet=${wallet.id}`;
          }}
          onEdit={onEdit}
          onTransfer={onTransfer}
          onReconcile={onReconcile}
          onDeactivate={onDeactivate}
          onReactivate={onReactivate}
          onDelete={onDelete}
        />
      </div>

      {/* Balance */}
      <div className="mt-4">
        <p
          className="font-mono text-2xl font-bold"
          data-testid="wallet-balance"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {hideAmount ? '•••••' : formatCurrency(balance)}
        </p>
        {spendingTrend && (
          <div className="flex items-center gap-1.5 mt-1">
            {spendingTrend.isUp ? (
              <TrendUp size={14} className="text-red-500" aria-hidden="true" />
            ) : (
              <TrendDown size={14} className="text-green-500" aria-hidden="true" />
            )}
            <span className={`text-xs font-medium ${spendingTrend.isUp ? 'text-red-500' : 'text-green-500'}`}>
              {spendingTrend.isUp ? '+' : ''}{spendingTrend.change.toFixed(0)}%
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {t('last 7 days')}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
