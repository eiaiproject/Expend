import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from '../BottomSheetShell';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { formatCurrency } from '../../utils/formatUtils';
import { adjustWalletBalance } from '../../services/walletService';
import { toast } from '../Toaster';
import type { Wallet } from '../../db/db';

interface ReconcileBalanceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: Wallet;
}

/**
 * Reconcile Balance sheet.
 *
 * Shows:
 * - Recorded balance (current ledger balance)
 * - Actual balance input (what the user says it should be)
 * - Difference (computed)
 * - Date (today, non-editable)
 * - Notes (optional)
 * - Impact explanation
 *
 * On save: creates a balance_adjustment transaction via adjustWalletBalance.
 */
export function ReconcileBalanceSheet({ isOpen, onClose, wallet }: ReconcileBalanceSheetProps) {
  const { t } = useTranslation();
  const { hideAmount } = usePrivacy();

  const recordedBalance = wallet.currentBalance ?? wallet.initialBalance;
  const [actualBalanceInput, setActualBalanceInput] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Parse actual balance from input
  const parsedActual = parseInt(actualBalanceInput.replace(/[^0-9-]/g, ''), 10);
  const actualBalance = isNaN(parsedActual) ? recordedBalance : parsedActual;
  const difference = actualBalance - recordedBalance;

  // Reset form when wallet changes or sheet opens
  useEffect(() => {
    if (isOpen) {
      setActualBalanceInput('');
      setNotes('');
    }
  }, [isOpen, wallet.id]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await adjustWalletBalance(wallet.id!, actualBalance, {
        description: t('wallet.reconcileTitle'),
        notes: notes.trim() || undefined,
      });
      toast.add(t('wallet.reconcileSaved'));
      onClose();
    } catch {
      toast.add(t('wallet.reconcileError'));
    } finally {
      setIsSaving(false);
    }
  };

  const today = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('wallet.reconcileTitle')}
      ariaLabel={t('wallet.reconcileTitle')}
    >
      <div className="p-4 space-y-5">
        {/* Recorded balance */}
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-[var(--text-secondary)]">{t('wallet.reconcileRecorded')}</span>
          <span className="font-mono font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {hideAmount ? '•••••' : formatCurrency(recordedBalance)}
          </span>
        </div>

        {/* Actual balance input */}
        <div>
          <label htmlFor="reconcile-actual" className="block text-sm font-medium mb-1">
            {t('wallet.reconcileActual')}
          </label>
          <input
            id="reconcile-actual"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={actualBalanceInput}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9-]/g, '');
              setActualBalanceInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
            }}
            placeholder={formatCurrency(recordedBalance)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 font-mono focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
        </div>

        {/* Difference */}
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-[var(--text-secondary)]">{t('wallet.reconcileDiff')}</span>
          <span
            className={`font-mono font-bold ${difference > 0 ? 'text-green-500' : difference < 0 ? 'text-red-500' : ''}`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {hideAmount ? '•••••' : (
              difference === 0 ? formatCurrency(0) :
              `${difference > 0 ? '+' : ''}${formatCurrency(difference)}`
            )}
          </span>
        </div>

        {/* Date */}
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-[var(--text-secondary)]">{t('wallet.reconcileDate')}</span>
          <span className="text-sm">{today}</span>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="reconcile-notes" className="block text-sm font-medium mb-1">
            {t('wallet.reconcileNotes')}
          </label>
          <input
            id="reconcile-notes"
            type="text"
            autoComplete="off"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('wallet.reconcileNotesPh')}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
        </div>

        {/* Impact explanation */}
        <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg px-3 py-2">
          {t('wallet.reconcileImpact')}
        </p>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors active:scale-95"
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isNaN(parsedActual)}
            className="flex-1 h-11 rounded-xl bg-[var(--accent-fill)] text-white font-medium transition-colors hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? t('Saving...') : t('Save')}
          </button>
        </div>
      </div>
    </BottomSheetShell>
  );
}
