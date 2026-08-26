import { useId, useRef, useEffect, useState, type KeyboardEvent } from 'react';
import { useOverflow } from '../hooks/useOverflow';
import { toast } from './Toaster';
import { confirm } from './ConfirmDialog';
import { X, ArrowDownCircle, Repeat, Plus, ChevronDown, ChevronUp, Bookmark, Wallet, ShoppingBag } from 'reicon-react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction } from '../db/db';
import { cn } from '../utils/cn';
import { PRESET_AMOUNTS } from '../utils/constants';
import { sanitizeAmountInput, formatAmountDisplay } from '../utils/amountUtils';
import { suggestAmountsForPayee } from '../services/amountSuggestionService';
import { useTransactionForm } from '../hooks/useTransactionForm';
import { BottomSheetShell } from './BottomSheetShell';
import { CategorySelect } from './CategorySelect';
import { DatePicker } from './DatePicker';
import { WalletSelect } from './WalletSelect';
import type { TransactionType } from '../hooks/useTransactionForm';
import { deleteTemplate } from '../services/templateService';
import { INSUFFICIENT_WALLET_BALANCE_MESSAGE } from '../services/errors';
import { ReconcileBalanceSheet } from './wallet/ReconcileBalanceSheet';
import type { TransactionTemplate } from '../services/templateService';
import { PayeePickerSheet } from './PayeePickerSheet';
import { useDismissOnOutsideTap } from '../hooks/useDismissOnOutsideTap';

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
  // Payee picker popup — replaces the old link that navigated behind the form.
  const [showPayeePicker, setShowPayeePicker] = useState(false);
  // Edge fade only when the template chips actually overflow the screen.
  const { ref: templatesRef, overflows: templatesOverflows } = useOverflow<HTMLUListElement>();

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

  const handleTemplateClick = (template: TransactionTemplate) => {
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

  // Friction A4: silent category creation opt-out (default = confirm).
  const confirmNewCategorySetting = useLiveQuery(
    () => db.settings.get('confirmNewCategory').then((s) => (s?.value as boolean | undefined) ?? true),
    [], true,
  );

  const { state, actions, wallets, categories, templates, transactions, insufficientBalance, clearInsufficientBalance } = useTransactionForm({
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
      if (!confirmNewCategorySetting) return true; // silent create (opt-out)
      const confirmed = await confirm({
        title: t('Create New Category'),
        message: t('Category "{{name}}" does not exist. Create it?', { name }),
        variant: 'default',
      });
      return confirmed;
    },
  });

  // Friction audit B4: click-outside dismissal (replaces setTimeout-on-blur).
  const amountAreaRef = useRef<HTMLDivElement>(null);
  const descriptionAreaRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideTap(
    amountAreaRef,
    state.isAmountFocused && !state.amount,
    () => actions.setIsAmountFocused(false),
  );
  useDismissOnOutsideTap(
    descriptionAreaRef,
    state.showDescriptionSuggestions && state.filteredDescriptionSuggestions.length > 0 && state.description.trim() !== '',
    () => actions.setShowDescriptionSuggestions(false),
  );

  const selectedWallet = wallets.find((w) => w.id === Number(state.walletId));
  const selectedWalletName = selectedWallet?.name;
  // QA H3: opens the reconciliation sheet from the insufficient-balance banner.
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);

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

  // Raw digits while focused (no separators to fight the caret); formatted on blur.
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    actions.setAmount(sanitizeAmountInput(e.target.value));
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
    <>
    <BottomSheetShell
      isOpen={isOpen}
      onClose={handleCloseRequest}
      title={isEditingExistingTransaction ? t('Edit') : t('Add Transaction')}
      ariaLabel={isEditingExistingTransaction ? t('Edit') : t('Add Transaction')}
      size="full"
      disableEscape={showPayeePicker}
      footer={
        <div className="space-y-2 pb-[env(safe-area-inset-bottom)]">
          <button
            type="submit"
            form={formId}
            disabled={actions.isSubmitting}
            className="w-full bg-[var(--accent-fill)] text-[var(--accent-ink)] font-bold py-4 rounded-xl active:scale-95 transition-transform shadow-lg shadow-[var(--accent-fill)]/20 disabled:opacity-50 min-h-[52px]"
          >
            {t('Save')}
          </button>
          {isQuickAdd && (
            <button
              type="button"
              onClick={async () => {
                const saved = await actions.submitAndResetForNext();
                if (saved) {
                  requestAnimationFrame(() => document.getElementById(amountInputId)?.focus());
                }
              }}
              disabled={actions.isSubmitting}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[var(--accent)] border border-[var(--accent)]/30 bg-[var(--card)] active:scale-95 transition-transform min-h-[44px]"
            >
              {t('form.saveAndAddAnother')}
            </button>
          )}
        </div>
      }
    >
      <form id={formId} onSubmit={handleFormSubmit} className="px-4 py-4 space-y-4">
        {/* QA H3: actionable recovery when the save was rejected for insufficient balance. */}
        {insufficientBalance && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-900/20" role="alert">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-200 leading-snug">
              {t(INSUFFICIENT_WALLET_BALANCE_MESSAGE)}
            </span>
            {state.type === 'expense' && selectedWallet && (
              <button
                type="button"
                onClick={() => setIsReconcileOpen(true)}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white active:scale-95 transition-transform min-h-[36px]"
              >
                {t('form.setInitialBalance')}
              </button>
            )}
          </div>
        )}
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
            <ul ref={templatesRef} className={cn("flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-1 pb-1 list-none", templatesOverflows && "scroll-fade-x")} aria-label={t('Templates')}>
              {templates.slice(0, 4).map((template) => (
                <li key={template.id} className="snap-start">
                  <div className="flex items-center gap-1 pr-1 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl transition-colors hover:border-[var(--accent)]">
                    <button
                      type="button"
                      onClick={() => handleTemplateClick(template)}
                      onContextMenu={(e) => { e.preventDefault(); void handleDeleteTemplate(template.id); }}
                      className="px-2 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors active:scale-95 min-h-[44px] flex items-center gap-1.5 select-none"
                    >
                      <Bookmark size={14} aria-hidden="true" />
                      {template.name}
                    </button>
                    {/* Friction A7: visible delete — no more hidden long-press */}
                    <button
                      type="button"
                      aria-label={t('templates.deleteTitle')}
                      onClick={() => void handleDeleteTemplate(template.id)}
                      className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Amount */}
        <div ref={amountAreaRef}>
          <label htmlFor={amountInputId} className="block text-sm font-medium mb-1.5">{t('Nominal')} *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-mono font-bold">
              {t('Currency Symbol')}
            </span>
            <input
              id={amountInputId}
              type="text"
              inputMode="decimal"
              required
              value={state.isAmountFocused ? state.amount : formatAmountDisplay(state.amount)}
              onChange={handleAmountChange}
              onFocus={() => actions.setIsAmountFocused(true)}
              onBlur={() => actions.setIsAmountFocused(false)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl py-3 pl-12 pr-4 font-mono text-xl font-bold focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              placeholder="0"
            />
          </div>
          {state.isAmountFocused && !state.amount && (
            <div
              className="flex flex-wrap gap-2 mt-3"
            >
              {(state.description.trim()
                ? // Friction A5: payee-aware presets (most common amounts for this payee)
                  suggestAmountsForPayee(transactions, state.description, PRESET_AMOUNTS, 6)
                : PRESET_AMOUNTS
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => actions.setAmount(String(preset))}
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
                  const numericInput = form?.querySelector<HTMLInputElement>('input[inputMode="decimal"]');
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
            <label htmlFor={categoryInputId} className="block text-sm font-medium mb-1.5">{t('Category')}</label>
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

        {/* Quick Add shortcuts — pick a payee or expand the details section
            (friction audit A1: payee selection no longer requires expanding
            details first). */}
        {isQuickAdd && !showDetails && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setShowDetails(true); setShowPayeePicker(true); }}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors active:scale-95 min-h-[44px]"
            >
              <ShoppingBag size={16} aria-hidden="true" />
              {t('form.choosePayee')}
            </button>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              aria-expanded={false}
              aria-controls={`${formId}-details`}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors active:scale-95 min-h-[44px]"
            >
              <ChevronDown size={16} aria-hidden="true" />
              {t('Add details')}
            </button>
          </div>
        )}

        {/* Details section (hidden in Quick Add until expanded) */}
        {(!isQuickAdd || showDetails) && (
          <div id={`${formId}-details`} className="space-y-4">
            {/* Description */}
            <div className="relative" ref={descriptionAreaRef}>
              <label htmlFor={descriptionInputId} className="block text-sm font-medium mb-1.5">{t('Description')} {!isQuickAdd && '*'}</label>
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
                onKeyDown={handleDescriptionKeyDown}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 pr-10 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              />
              {state.description && (
                <button
                  type="button"
                  onClick={() => { actions.setDescription(''); actions.setShowDescriptionSuggestions(false); }}
                  className="absolute right-3 top-[40px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label={t('Clear')}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
              {state.description.trim() === '' && (
                /* preventDefault on mousedown keeps the input focused while
                   the tap lands — avoids the iOS case where the first tap
                   only dismisses the keyboard and the click is swallowed. */
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPayeePicker(true)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors min-h-[44px]"
                >
                  <ShoppingBag size={14} aria-hidden="true" />
                  {t('form.choosePayee')}
                </button>
              )}
              {state.showDescriptionSuggestions && state.filteredDescriptionSuggestions.length > 0 && state.description.trim() !== '' && (
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
                <label htmlFor={walletInputId} className="block text-sm font-medium mb-1.5">
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
                  <label htmlFor={toWalletInputId} className="block text-sm font-medium mb-1.5">{t('To Wallet')} *</label>
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
              <label htmlFor={notesInputId} className="block text-sm font-medium mb-1.5">{t('Notes')}</label>
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

    {/* Payee picker — pops up ABOVE this sheet (z-index 70 > 50) so the
        payee list is never hidden behind the form (design audit fix). */}
    <PayeePickerSheet
      isOpen={showPayeePicker}
      onClose={() => setShowPayeePicker(false)}
      onSelect={(name) => {
        actions.setDescription(name);
        setShowPayeePicker(false);
      }}
    />

    {/* QA H3: reconcile the selected wallet's balance from the inline banner. */}
    {selectedWallet && (
      <ReconcileBalanceSheet
        isOpen={isReconcileOpen}
        zIndex={70}
        onClose={() => {
          setIsReconcileOpen(false);
          // Balance was likely corrected — let the user retry the save directly.
          clearInsufficientBalance();
        }}
        wallet={selectedWallet}
      />
    )}
    </>
  );
}
