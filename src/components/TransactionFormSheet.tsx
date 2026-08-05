import { useId, useRef, useEffect, useState, type KeyboardEvent } from 'react';
import { toast } from './Toaster';
import { confirm } from './ConfirmDialog';
import { X, ArrowDownCircle, Repeat, Plus, ChevronDown, ChevronUp, Bookmark, Wallet } from 'reicon-react';
import { useTranslation } from 'react-i18next';
import { type Transaction } from '../db/db';
import { cn } from '../utils/cn';
import { PRESET_AMOUNTS } from '../utils/constants';
import { useTransactionForm } from '../hooks/useTransactionForm';
import { BottomSheetShell } from './BottomSheetShell';
import { CategorySelect } from './CategorySelect';
import { DatePicker } from './DatePicker';
import { WalletSelect } from './WalletSelect';
import type { TransactionType } from '../hooks/useTransactionForm';
import { deleteTemplate } from '../services/templateService';
import type { TransactionTemplate } from '../services/templateService';

interface TransactionFormSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly txToEdit?: Transaction | null;
  readonly initialType?: TransactionType;
  readonly initialDescription?: string;
  readonly initialFromWalletId?: number;
  readonly initialToWalletId?: number;
  readonly initialAmount?: string;
  readonly initialNotes?: string;
}

export function TransactionFormSheet({
  isOpen,
  onClose,
  txToEdit,
  initialType = 'expense',
  initialDescription,
  initialFromWalletId,
  initialToWalletId,
  initialAmount,
  initialNotes,
}: TransactionFormSheetProps) {
  const { t } = useTranslation();
  const isEditingExistingTransaction = !!txToEdit?.id;
  // Quick Add: brand-new expense with no prefilled values — progressive
  // disclosure keeps only Amount + Category + Save visible (master.md 5.1).
  const isQuickAdd =
    !txToEdit &&
    initialType === 'expense' &&
    !initialDescription &&
    !initialAmount &&
    !initialFromWalletId &&
    !initialToWalletId;
  const [showDetails, setShowDetails] = useState(!isQuickAdd);

  // master.md 8.4: closing the sheet (backdrop, Escape, X) with unsaved
  // changes requires explicit confirmation. Successful saves call onClose
  // directly via handleSubmit, so they bypass this guard.
  const handleCloseRequest = async () => {
    if (actions.isDirty()) {
      const confirmed = await confirm({
        title: t('form.discardTitle'),
        message: t('form.discardMessage'),
        confirmLabel: t('form.discardConfirm'),
        variant: 'danger',
      });
      if (!confirmed) return;
    }
    onClose();
  };

  // Reset the disclosure state whenever the sheet opens
  useEffect(() => {
    if (isOpen) setShowDetails(!isQuickAdd);
  }, [isOpen, isQuickAdd]);

  // Long-press (600ms) or right-click on a template chip → delete (master.md 5.4)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }, []);

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleDeleteTemplate = async (id: string) => {
    const template = templates.find(t => t.id === id);
    const ok = await confirm({
      title: t('templates.deleteTitle'),
      message: t('templates.deleteMessage', { name: template?.name ?? '' }),
      confirmLabel: t('templates.deleteConfirm'),
      cancelLabel: t('templates.deleteCancel'),
      variant: 'danger',
    });
    if (!ok) return;
    await deleteTemplate(id);
    toast.add(t('templates.deletedToast'));
  };

  const startLongPress = (id: string) => {
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(50); // NOSONAR:S6819 — haptic cue, not an interactive role
      void handleDeleteTemplate(id);
    }, 600);
  };

  const handleTemplateClick = (template: TransactionTemplate) => {
    if (didLongPress.current) { didLongPress.current = false; return; } // suppress apply after delete long-press
    void actions.applyTemplate(template);
  };

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

  const { state, actions, wallets, categories, templates } = useTransactionForm({
    isOpen,
    txToEdit,
    initialType,
    initialDescription,
    initialFromWalletId,
    initialToWalletId,
    initialAmount,
    initialNotes,
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

  const selectedWalletName = wallets.find((w) => w.id === Number(state.walletId))?.name;

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
    if (state.type === 'transfer' && Number.parseInt(state.walletId, 10) === Number.parseInt(state.toWalletId, 10)) {
      toast.add(t('Cannot transfer to the same wallet.'));
      return;
    }

    await actions.handleSubmit();
  };

  const handleSaveAsTemplate = async () => {
    // saveCurrentAsTemplate shows its own toast; keep the form open so the
    // user can still save the transaction.
    await actions.saveCurrentAsTemplate();
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={handleCloseRequest}
      title={isEditingExistingTransaction ? t('Edit') : t('Add Transaction')}
      ariaLabel={isEditingExistingTransaction ? t('Edit') : t('Add Transaction')}
      size="full"
      footer={
        <button
          type="submit"
          form={formId}
          disabled={actions.isSubmitting}
          className="w-full bg-[var(--accent-fill)] text-[var(--accent-ink)] font-bold py-4 rounded-xl active:scale-95 transition-transform shadow-lg shadow-[var(--accent-fill)]/20 disabled:opacity-50 min-h-[52px]"
        >
          {t('Save')}
        </button>
      }
    >
      <form id={formId} onSubmit={handleFormSubmit} className="px-3 py-4 space-y-5">
        {/* Type Tabs */}
        <div className="flex p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)]" role="radiogroup" aria-label={t('Transaction type')}>
          {[
            { id: 'expense', label: t('Expense'), icon: ArrowDownCircle },
            { id: 'transfer', label: t('Transfer'), icon: Repeat, disabled: wallets.length < 2 },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={'disabled' in item ? item.disabled : false}
              onClick={() => actions.setType(item.id as 'expense' | 'transfer')}
              role="radio"
              aria-checked={state.type === item.id}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                state.type === item.id
                  ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ('disabled' in item && item.disabled) && 'opacity-40 cursor-not-allowed'
              )}
            >
              <item.icon size={16} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Templates (Quick Add only — small number of the most useful) */}
        {isQuickAdd && templates.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('Templates')}</p>
            <ul className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-1 scroll-fade-x pb-1 list-none" aria-label={t('Templates')}>
              {templates.slice(0, 4).map((template) => (
                <li key={template.id} className="snap-start">
                  <button
                    type="button"
                    onClick={() => handleTemplateClick(template)}
                    onPointerDown={() => startLongPress(template.id)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onContextMenu={(e) => { e.preventDefault(); void handleDeleteTemplate(template.id); }}
                    className="shrink-0 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors active:scale-95 min-h-[44px] flex items-center gap-1.5 select-none"
                  >
                    <Bookmark size={14} aria-hidden="true" />
                    {template.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Amount */}
        <div>
          <label htmlFor={amountInputId} className="block text-sm font-medium mb-1">{t('Nominal')} *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-mono font-bold">
              {t('Currency Symbol')}
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
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl py-3 pl-12 pr-4 font-mono text-xl font-bold focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              placeholder="0"
            />
          </div>
          {state.isAmountFocused && !state.amount && (
            <div
              className="flex flex-wrap gap-2 mt-3"
            >
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => actions.setAmount(preset.toLocaleString('id-ID'))}
                  className="px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-xs font-mono font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors active:scale-95"
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
                className="px-3 py-1.5 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-[var(--accent)]/20 transition-colors active:scale-95"
              >
                <Plus size={12} /> {t('Custom')}
              </button>
            </div>
          )}
        </div>

        {/* Category — always visible */}
        {state.type !== 'transfer' && (
          <div>
            <label htmlFor={categoryInputId} className="block text-sm font-medium mb-1">{t('Category')}</label>
            <CategorySelect
              id={categoryInputId}
              categories={categories}
              value={state.categoryName}
              onChange={actions.setCategoryName}
              placeholder={t('Type or select category')}
            />
          </div>
        )}

        {/* Quick Add default wallet — visible so the wrong wallet is never
            used silently (master.md 3.7). Tapping expands the details section. */}
        {isQuickAdd && !showDetails && selectedWalletName && (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors active:scale-95 min-h-[44px]"
          >
            <Wallet size={14} aria-hidden="true" />
            <span className="font-medium">{t('Wallet')}: {selectedWalletName}</span>
          </button>
        )}

        {/* Progressive disclosure toggle (Quick Add) */}
        {isQuickAdd && !showDetails && (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            aria-expanded={false}
            aria-controls={`${formId}-details`}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors active:scale-95 min-h-[44px]"
          >
            <ChevronDown size={16} aria-hidden="true" />
            {t('Add details')}
          </button>
        )}

        {/* Details section (hidden in Quick Add until expanded) */}
        {(!isQuickAdd || showDetails) && (
          <div id={`${formId}-details`}>
            {/* Description */}
            <div className="relative">
              <label htmlFor={descriptionInputId} className="block text-sm font-medium mb-1">{t('Description')} {!isQuickAdd && '*'}</label>
              <input
                id={descriptionInputId}
                ref={descriptionRef}
                type="text"
                autoComplete="off"
                required={!isQuickAdd}
                aria-required={!isQuickAdd}
                value={state.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onFocus={() => actions.setShowDescriptionSuggestions(true)}
                onBlur={() => setTimeout(() => actions.setShowDescriptionSuggestions(false), 200)}
                onKeyDown={handleDescriptionKeyDown}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 pr-10 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              />
              {state.description && (
                <button
                  type="button"
                  onClick={() => { actions.setDescription(''); actions.setShowDescriptionSuggestions(false); }}
                  className="absolute right-3 top-[38px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label={t('Clear')}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
              {state.showDescriptionSuggestions && state.filteredDescriptionSuggestions.length > 0 && (
                <div
                  className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden"
                >
                  {state.filteredDescriptionSuggestions.map((desc, idx) => (
                    <button
                      key={desc}
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
                </div>
              )}
            </div>

            {/* Date */}
            <DatePicker
              id={dateInputId}
              value={state.date}
              onChange={actions.setDate}
              label={t('Date')}
              required
            />

            {/* Wallet(s) */}
            <div className="space-y-4">
              <div>
                <label htmlFor={walletInputId} className="block text-sm font-medium mb-1">
                  {state.type === 'transfer' ? t('From Wallet') : t('Wallet')} *
                </label>
                <WalletSelect
                  id={walletInputId}
                  value={state.walletId}
                  wallets={wallets}
                  placeholder={t('Select Wallet')}
                  onChange={actions.setWalletId}
                />
              </div>
              {state.type === 'transfer' && (
                <div>
                  <label htmlFor={toWalletInputId} className="block text-sm font-medium mb-1">{t('To Wallet')} *</label>
                  <WalletSelect
                    id={toWalletInputId}
                    value={state.toWalletId}
                    wallets={wallets}
                    placeholder={t('Select Destination Wallet')}
                    onChange={actions.setToWalletId}
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor={notesInputId} className="block text-sm font-medium mb-1">{t('Notes')}</label>
              <input
                id={notesInputId}
                name="notes"
                type="text"
                autoComplete="off"
                value={state.notes}
                onChange={(e) => actions.setNotes(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              />
            </div>

            {/* Save current form as a template */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors active:scale-95 min-h-[44px]"
              >
                <Bookmark size={14} aria-hidden="true" />
                {t('Save as template')}
              </button>
              {isQuickAdd && (
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  aria-expanded={true}
                  aria-controls={`${formId}-details`}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors active:scale-95 min-h-[44px]"
                >
                  <ChevronUp size={14} aria-hidden="true" />
                  {t('Hide details')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Submit — sticky footer in BottomSheetShell (visible above keyboard) */}
      </form>
    </BottomSheetShell>
  );
}
