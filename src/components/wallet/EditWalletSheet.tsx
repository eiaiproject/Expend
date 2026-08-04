import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from '../BottomSheetShell';
import { db, type Wallet } from '../../db/db';
import { toast } from '../Toaster';

const WALLET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b', '#78716c'];

interface EditWalletSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly wallet: Wallet;
}

/**
 * Edit Wallet form in a bottom sheet.
 *
 * Can edit:
 * - Wallet name
 * - Color
 *
 * Cannot edit (use Reconcile Balance instead):
 * - Balance
 * - Currency (if wallet has transactions)
 *
 * Validation:
 * - Name cannot be empty or whitespace-only
 * - Duplicate names blocked
 *
 * On save: updates wallet name and color in IndexedDB.
 */
export function EditWalletSheet({ isOpen, onClose, wallet }: EditWalletSheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(wallet.name);
  const [color, setColor] = useState(wallet.color || '#6366f1');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Sync state when wallet changes
  useEffect(() => {
    if (isOpen) {
      setName(wallet.name);
      setColor(wallet.color || '#6366f1');
      setError('');
      const timer = setTimeout(() => nameRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, wallet.name, wallet.color]);

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
      const existing = await db.wallets
        .where('name')
        .equalsIgnoreCase(trimmedName)
        .first();
      if (existing && existing.id !== wallet.id) {
        setError(t('wallet.addDuplicate'));
        setIsSaving(false);
        return;
      }

      await db.wallets.update(wallet.id!, {
        name: trimmedName,
        color,
      });
      toast.add(t('wallet.editSaved'));
      onClose();
    } catch {
      toast.add(t('wallet.editError'));
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
      title={t('wallet.editTitle')}
      ariaLabel={t('wallet.editTitle')}
      size="content"
      footer={
        <div className="flex gap-3">
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
      }
    >
      <div className="p-4 space-y-5">
        {/* Wallet name */}
        <div>
          <label htmlFor="edit-wallet-name" className="block text-sm font-medium mb-1">
            {t('wallet.addNameLabel')} <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            ref={nameRef}
            id="edit-wallet-name"
            type="text"
            name="walletName"
            autoComplete="off"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            aria-invalid={!!error}
            aria-describedby={error ? 'edit-wallet-name-error' : undefined}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
          {error && (
            <p id="edit-wallet-name-error" className="mt-1 text-xs text-red-500" role="alert">
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

        {/* Info: balance cannot be edited here */}
        <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg px-3 py-2">
          {t('wallet.reconcileImpact')}
        </p>
      </div>
    </BottomSheetShell>
  );
}
