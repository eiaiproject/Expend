import { AlertTriangle, Ban, Wallet } from 'reicon-react';
import { useTranslation } from 'react-i18next';
import { INSUFFICIENT_WALLET_BALANCE_MESSAGE } from '../../services/errors';
import { cn } from '../../utils/cn';
import type { Wallet as WalletType } from '../../db/db';
import { WalletSelect } from '../WalletSelect';

interface WalletMovementSectionProps {
  readonly formId: string;
  readonly isPayable: boolean;
  readonly hasWalletMovement: boolean;
  readonly onToggle: (value: boolean) => void;
  readonly walletId: string;
  readonly onWalletChange: (value: string) => void;
  readonly wallets: WalletType[];
  readonly hasInsufficientBalance: boolean;
}

/**
 * "Wallet movement" section of the debt form: whether money moves to/from a
 * wallet, which wallet, and an insufficient-balance warning for receivables.
 * Extracted from DebtFormSheet to keep the form's cognitive complexity within
 * the S3776 limit.
 */
export function WalletMovementSection({
  formId,
  isPayable,
  hasWalletMovement,
  onToggle,
  walletId,
  onWalletChange,
  wallets,
  hasInsufficientBalance,
}: WalletMovementSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <div>
        <p className="block text-sm font-medium mb-2">
          {isPayable ? t('debt.formFundsReceived') : t('debt.formFundsProvided')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onToggle(true)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-colors',
              hasWalletMovement
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]',
            )}
            aria-pressed={hasWalletMovement}
          >
            <Wallet size={16} />
            {t('debt.formYesWallet')}
          </button>
          <button
            type="button"
            onClick={() => onToggle(false)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-colors',
              !hasWalletMovement
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]',
            )}
            aria-pressed={!hasWalletMovement}
          >
            <Ban size={16} />
            {t('debt.formNoWallet')}
          </button>
        </div>
      </div>

      {hasWalletMovement && (
        <div>
          <label htmlFor={`${formId}-wallet`} className="block text-sm font-medium mb-1.5">
            {isPayable ? t('Money into wallet') : t('Money from wallet')} *
          </label>
          <WalletSelect
            id={`${formId}-wallet`}
            value={walletId}
            wallets={wallets}
            placeholder={t('Select wallet')}
            onChange={onWalletChange}
          />
          {hasInsufficientBalance && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{t(INSUFFICIENT_WALLET_BALANCE_MESSAGE)}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
