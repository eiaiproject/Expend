import { useId, useRef, type KeyboardEvent } from 'react';
import { toast } from './Toaster';
import { confirm } from './ConfirmDialog';
import { motion } from 'motion/react';
import { X, ArrowDownCircle, Repeat, Wallet as WalletIcon, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type Transaction } from '../db/db';
import { cn } from '../utils/cn';
import { PRESET_AMOUNTS } from '../utils/constants';
import { useTransactionForm } from '../hooks/useTransactionForm';
import { BottomSheetShell } from './BottomSheetShell';
import { CategorySelect } from './CategorySelect';
import { DatePicker } from './DatePicker';
import type { TransactionType } from '../hooks/useTransactionForm';

interface TransactionFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  txToEdit?: Transaction | null;
  initialType?: TransactionType;
}

export function TransactionFormSheet({ isOpen, onClose, txToEdit, initialType = 'expense' }: TransactionFormSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const amountInputId = `${formId}-amount`;
  const descriptionInputId = `${formId}-description`;
  const dateInputId = `${formId}-date`;
  const categoryInputId = `${formId}-category`;
  const walletInputId = `${formId}-wallet`;
  const toWalletInputId = `${formId}-to-wallet`;
  const notesInputId = `${formId}-notes`;
  const descriptionRef = useRef<HTMLInputElement>(null);
  const suggestionIndexRef = useRef(-1);

  const { state, actions, wallets, categories } = useTransactionForm({
    isOpen,
    txToEdit,
    initialType,
    onClose,
    onConfirmCreateCategory: async (name: string) => {
      const confirmed = await confirm({
        title: t('Create New Category'),
        message: t('Category "{{name}}" does not exist. Create it?', { name }),
        variant: 'default',
      });
      return confirmed;
    },
  });

  const handleDescriptionChange = (val: string) => {
    actions.setDescription(val);
    actions.setShowDescriptionSuggestions(true);
    suggestionIndexRef.current = -1;
  };

  const selectSuggestion = (val: string) => {
    actions.setDescription(val);
    actions.setShowDescriptionSuggestions(false);
    suggestionIndexRef.current = -1;
  };

  const handleDescriptionKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!state.showDescriptionSuggestions || state.filteredDescriptionSuggestions.length === 0) {
      if (e.key === 'Enter') return;
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      suggestionIndexRef.current = Math.min(
        suggestionIndexRef.current + 1,
        state.filteredDescriptionSuggestions.length - 1
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      suggestionIndexRef.current = Math.max(suggestionIndexRef.current - 1, -1);
    } else if (e.key === 'Enter' && suggestionIndexRef.current >= 0) {
      e.preventDefault();
      selectSuggestion(state.filteredDescriptionSuggestions[suggestionIndexRef.current]!);
    } else if (e.key === 'Escape') {
      actions.setShowDescriptionSuggestions(false);
      suggestionIndexRef.current = -1;
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate same wallet for transfer
    if (state.type === 'transfer' && parseInt(state.walletId, 10) === parseInt(state.toWalletId, 10)) {
      toast.add(t('Cannot transfer to the same wallet.'));
      return;
    }
    // Validate transfer edit
    if (state.type === 'transfer' && txToEdit && txToEdit.id) {
      toast.add(t('Editing transfers is not supported in this version.'));
      return;
    }

    const success = await actions.handleSubmit();
    if (!success && state.amount && state.description) {
      // Only show error if form was filled (not validation empty)
      if (state.type === 'transfer' && parseInt(state.walletId, 10) === parseInt(state.toWalletId, 10)) {
        // Already toasted above
      } else {
        toast.add(t('Error'));
      }
    }
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={txToEdit ? t('Edit') : t('Add Transaction')}
      ariaLabel={txToEdit ? t('Edit') : t('Add Transaction')}
    >
      <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Type Tabs */}
        <div className="flex p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
          {[
            { id: 'expense', label: t('Expense'), icon: ArrowDownCircle },
            { id: 'transfer', label: t('Transfer'), icon: Repeat, disabled: wallets.length < 2 },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={'disabled' in item ? item.disabled : false}
              onClick={() => actions.setType(item.id as 'expense' | 'transfer')}
              aria-pressed={state.type === item.id}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                state.type === item.id
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ('disabled' in item && item.disabled) && 'opacity-40 cursor-not-allowed'
              )}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div>
          <label htmlFor={amountInputId} className="block text-sm font-medium mb-1">{t('Nominal')} *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-mono font-bold">
              Rp
            </span>
            <input
              id={amountInputId}
              type="text"
              inputMode="numeric"
              required
              value={state.amount}
              onChange={actions.handleAmountChange}
              onFocus={() => actions.setIsAmountFocused(true)}
              onBlur={() => setTimeout(() => actions.setIsAmountFocused(false), 200)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl py-3 pl-12 pr-4 font-mono text-xl font-bold focus:outline-none focus:border-[var(--accent)]"
              placeholder="0"
            />
          </div>
          {state.isAmountFocused && !state.amount && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 mt-3"
            >
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => actions.setAmount(preset.toLocaleString('id-ID'))}
                  className="px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-xs font-mono font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all active:scale-95"
                >
                  Rp {preset.toLocaleString('id-ID')}
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  actions.setIsAmountFocused(true);
                  const form = (e.currentTarget as HTMLElement).closest('form');
                  const numericInput = form?.querySelector<HTMLInputElement>('input[inputMode="numeric"]');
                  numericInput?.focus();
                }}
                className="px-3 py-1.5 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-[var(--accent)]/20 transition-all active:scale-95"
              >
                <Plus size={12} /> Custom
              </button>
            </motion.div>
          )}
        </div>

        {/* Description */}
        <div className="relative">
          <label htmlFor={descriptionInputId} className="block text-sm font-medium mb-1">{t('Description')} *</label>
          <input
            id={descriptionInputId}
            ref={descriptionRef}
            type="text"
            required
            autoComplete="off"
            value={state.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            onFocus={() => actions.setShowDescriptionSuggestions(true)}
            onBlur={() => setTimeout(() => actions.setShowDescriptionSuggestions(false), 200)}
            onKeyDown={handleDescriptionKeyDown}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-[var(--accent)]"
          />
          {state.description && (
            <button
              type="button"
              onClick={() => { actions.setDescription(''); actions.setShowDescriptionSuggestions(false); }}
              className="absolute right-3 top-[38px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label={t('Clear')}
            >
              <X size={16} />
            </button>
          )}
          {state.showDescriptionSuggestions && state.filteredDescriptionSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden"
            >
              {state.filteredDescriptionSuggestions.map((desc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSuggestion(desc)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg)] transition-colors',
                    idx === suggestionIndexRef.current ? 'bg-[var(--bg)]' : ''
                  )}
                >
                  {desc}
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Date & Category */}
        <div className={cn(
          "grid gap-4 items-start",
          state.type === 'transfer' ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
        )}>
          <DatePicker
            id={dateInputId}
            value={state.date}
            onChange={actions.setDate}
            label={t('Date')}
            required
          />
          {state.type !== 'transfer' && (
            <div>
              <label htmlFor={categoryInputId} className="block text-sm font-medium mb-1">{t('Category')} *</label>
              <CategorySelect
                id={categoryInputId}
                categories={categories}
                value={state.categoryName}
                onChange={actions.setCategoryName}
                placeholder={t('Type or select category')}
              />
            </div>
          )}
        </div>

        {/* Wallet(s) */}
        <div className="space-y-4">
          <div>
            <label htmlFor={walletInputId} className="block text-sm font-medium mb-1">
              {state.type === 'transfer' ? t('From Wallet') : t('Wallet')} *
            </label>
            <div className="relative">
              <WalletIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
              <select
                id={walletInputId}
                required
                value={state.walletId}
                onChange={(e) => actions.setWalletId(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-12 pr-10 py-3 focus:outline-none focus:border-[var(--accent)] appearance-none"
              >
                <option value="" disabled>{t('Select Wallet')}</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>
          {state.type === 'transfer' && (
            <div>
              <label htmlFor={toWalletInputId} className="block text-sm font-medium mb-1">{t('To Wallet')} *</label>
              <div className="relative">
                <WalletIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                <select
                  id={toWalletInputId}
                  required
                  value={state.toWalletId}
                  onChange={(e) => actions.setToWalletId(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-12 pr-10 py-3 focus:outline-none focus:border-[var(--accent)] appearance-none"
                >
                  <option value="" disabled>{t('Select Destination Wallet')}</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor={notesInputId} className="block text-sm font-medium mb-1">{t('Notes')}</label>
          <input
            id={notesInputId}
            type="text"
            value={state.notes}
            onChange={(e) => actions.setNotes(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Submit */}
        <div className="pt-4 pb-6">
          <button
            type="submit"
            disabled={actions.isSubmitting}
            className="w-full bg-[var(--accent)] text-white font-bold py-4 rounded-xl active:scale-95 transition-transform shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50"
          >
            {t('Save')}
          </button>
        </div>
      </form>
    </BottomSheetShell>
  );
}
