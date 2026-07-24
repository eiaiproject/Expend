import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from '../BottomSheetShell';
import { db } from '../../db/db';
import { toast } from '../Toaster';

const WALLET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b', '#78716c'];

interface AddWalletSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Add Wallet form in a bottom sheet.
 *
 * Fields:
 * - Wallet name (required)
 * - Initial balance (optional, numeric)
 * - Color (optional, hex)
 *
 * Validation:
 * - Name cannot be empty or whitespace-only
 * - Duplicate names blocked
 * - Initial balance parsed as integer
 *
 * On save: creates wallet in IndexedDB with currentBalance = initialBalance.
 */
export function AddWalletSheet({ isOpen, onClose }: AddWalletSheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [balanceInput, setBalanceInput] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus name input when sheet opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => nameRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset form
  useEffect(() => {
    if (isOpen) {
      setName('');
      setBalanceInput('');
      setColor('#6366f1');
      setError('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('wallet.addNameLabel'));
      nameRef.current?.focus();
      return;
    }

    if (isSaving) return;
    setIsSaving(true);
    setError('');

    try {
      const existing = await db.wallets.where('name').equalsIgnoreCase(trimmedName).first();
      if (existing) {
        setError(t('wallet.addDuplicate'));
        setIsSaving(false);
        return;
      }

      const initialBalance = parseInt(balanceInput.replace(/[^0-9-]/g, ''), 10) || 0;

      await db.wallets.add({
        name: trimmedName,
        currency: 'IDR',
        initialBalance,
        currentBalance: initialBalance,
        lastUpdated: new Date().toISOString(),
        color,
      });

      toast.add(t('wallet.addSaved'));
      onClose();
    } catch {
      toast.add(t('wallet.addError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('wallet.addTitle')}
      ariaLabel={t('wallet.addTitle')}
    >
      <div className="p-4 space-y-5">
        {/* Wallet name */}
        <div>
          <label htmlFor="add-wallet-name" className="block text-sm font-medium mb-1">
            {t('wallet.addNameLabel')} <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            ref={nameRef}
            id="add-wallet-name"
            type="text"
            name="walletName"
            autoComplete="off"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder={t('wallet.addNamePh')}
            aria-invalid={!!error}
            aria-describedby={error ? 'add-wallet-name-error' : undefined}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
          {error && (
            <p id="add-wallet-name-error" className="mt-1 text-xs text-red-500" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium mb-2">{t('wallet.colorLabel')}</label>
          <div className="flex flex-wrap gap-2">
            {WALLET_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setColor(hex)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === hex ? 'ring-2 ring-offset-2 ring-[var(--accent)] scale-110' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: hex }}
                aria-label={hex}
                aria-pressed={color === hex}
              />
            ))}
          </div>
        </div>

        {/* Initial balance */}
        <div>
          <label htmlFor="add-wallet-balance" className="block text-sm font-medium mb-1">
            {t('wallet.addBalanceLabel')}
          </label>
          <input
            id="add-wallet-balance"
            type="text"
            inputMode="numeric"
            name="initialBalance"
            autoComplete="off"
            value={balanceInput}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9-]/g, '');
              setBalanceInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
            }}
            onKeyDown={handleKeyDown}
            placeholder="0"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 font-mono focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {t('wallet.addBalanceHelper')} <span className="text-[var(--text-secondary)]/70">{t('wallet.initialBalanceNote')}</span>
          </p>
        </div>

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
            disabled={isSaving || !name.trim()}
            className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-white font-medium transition-colors hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? t('Saving...') : t('Save')}
          </button>
        </div>
      </div>
    </BottomSheetShell>
  );
}
