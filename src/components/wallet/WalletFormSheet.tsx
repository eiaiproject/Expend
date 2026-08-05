import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db, type Wallet } from '../../db/db';
import { toast } from '../Toaster';
import { BottomSheetShell } from '../BottomSheetShell';
import { SheetFormFooter } from './SheetFormFooter';
import { WalletColorPicker } from './WalletColorPicker';
import { WalletNameField } from './WalletNameField';

const DEFAULT_COLOR = '#6366f1';

interface WalletFormSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** When set, the sheet edits this wallet; otherwise it creates a new one. */
  readonly wallet?: Wallet | null;
}

/**
 * Add/Edit wallet form in a bottom sheet. One implementation shared by the
 * AddWalletSheet and EditWalletSheet flows so the two variants stay CPD-clean.
 *
 * Add mode:
 * - Wallet name (required), initial balance (optional), color
 * Edit mode:
 * - Wallet name and color only (use Reconcile Balance for balances)
 *
 * Validation:
 * - Name cannot be empty or whitespace-only
 * - Duplicate names blocked (in edit mode, the wallet itself is excluded)
 *
 * On save: creates or updates the wallet in IndexedDB.
 */
export function WalletFormSheet({ isOpen, onClose, wallet = null }: WalletFormSheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(wallet?.name ?? '');
  const [balanceInput, setBalanceInput] = useState('');
  const [color, setColor] = useState(wallet?.color || DEFAULT_COLOR);
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

  // Reset form whenever the sheet opens (deps mirror EditWalletSheet's original)
  useEffect(() => {
    if (!isOpen) return;
    setName(wallet?.name ?? '');
    setBalanceInput('');
    setColor(wallet?.color || DEFAULT_COLOR);
    setError('');
  }, [isOpen, wallet?.name, wallet?.color]);

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
      if (existing && existing.id !== wallet?.id) {
        setError(t('wallet.addDuplicate'));
        setIsSaving(false);
        return;
      }

      if (wallet) {
        await db.wallets.update(wallet.id!, { name: trimmedName, color });
        toast.add(t('wallet.editSaved'));
      } else {
        const initialBalance = Number.parseInt(balanceInput.replace(/[^0-9-]/g, ''), 10) || 0;
        await db.wallets.add({
          name: trimmedName,
          currency: 'IDR',
          initialBalance,
          currentBalance: initialBalance,
          lastUpdated: new Date().toISOString(),
          color,
        });
        toast.add(t('wallet.addSaved'));
      }

      onClose();
    } catch {
      toast.add(t(wallet ? 'wallet.editError' : 'wallet.addError'));
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

  const title = wallet ? t('wallet.editTitle') : t('wallet.addTitle');

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      ariaLabel={title}
      size="content"
      footer={
        <SheetFormFooter onCancel={onClose} onSave={handleSave} isSaving={isSaving} canSave={!!name.trim()} />
      }
    >
      <div className="p-4 space-y-5">
        {/* Wallet name */}
        <WalletNameField
          id={wallet ? 'edit-wallet-name' : 'add-wallet-name'}
          inputRef={nameRef}
          value={name}
          error={error}
          onChange={(value) => { setName(value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder={wallet ? undefined : t('wallet.addNamePh')}
        />

        {/* Color */}
        <WalletColorPicker value={color} onChange={setColor} />

        {/* Edit mode: balances are managed via Reconcile Balance */}
        {wallet ? (
          <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg px-3 py-2">
            {t('wallet.reconcileImpact')}
          </p>
        ) : (
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
                setBalanceInput(val ? Number.parseInt(val, 10).toLocaleString('id-ID') : '');
              }}
              onKeyDown={handleKeyDown}
              placeholder="0"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 font-mono focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
            />
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {t('wallet.addBalanceHelper')} <span className="text-[var(--text-secondary)]/70">{t('wallet.initialBalanceNote')}</span>
            </p>
          </div>
        )}
      </div>
    </BottomSheetShell>
  );
}
