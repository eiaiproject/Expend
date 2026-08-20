import { useState, useEffect, useMemo, useRef, useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction, type Wallet, type Category, type Merchant } from '../db/db';
import { INSUFFICIENT_WALLET_BALANCE_MESSAGE, saveTransaction, saveTransfer, updateTransfer } from '../services/transactionSaveService';
import { CURATED_PALETTE } from '../utils/constants';
import { getTodayStr } from '../utils/dateUtils';
import { toast } from '../components/Toaster';
import { confirm } from '../components/ConfirmDialog';
import { findRecentDuplicate } from '../services/duplicateDetectionService';
import { findPairedTransfer } from '../utils/transferUtils';
import { getDefaultExpenseWallet, rememberLastUsedWallet } from '../services/walletPreferenceService';
import { suggestCategoryForPayee } from '../services/categorySuggestionService';
import { getTemplates, resolveTemplate, saveTemplate, type TransactionTemplate } from '../services/templateService';
import { sanitizeAmountInput, parseAmountToNumber, numberToAmountInput } from '../utils/amountUtils';

const EMPTY_WALLETS: Wallet[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_MERCHANTS: Merchant[] = [];
const EMPTY_TEMPLATES: TransactionTemplate[] = [];

const LAST_SELECTED_CATEGORY_KEY = 'lastSelectedCategoryId';

export type TransactionType = 'expense' | 'transfer';

export interface TransactionFormState {
  type: TransactionType;
  amount: string;
  description: string;
  date: string;
  walletId: string;
  toWalletId: string;
  categoryName: string;
  notes: string;
  isAmountFocused: boolean;
  showDescriptionSuggestions: boolean;
  filteredDescriptionSuggestions: string[];
}

export interface TransactionFormActions {
  setType: (val: TransactionType) => void;
  setAmount: (val: string) => void;
  setDescription: (val: string) => void;
  setDate: (val: string) => void;
  setWalletId: (val: string) => void;
  setToWalletId: (val: string) => void;
  setCategoryName: (val: string) => void;
  setNotes: (val: string) => void;
  setIsAmountFocused: (val: boolean) => void;
  setShowDescriptionSuggestions: (val: boolean) => void;
  handleAmountChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: () => Promise<boolean>;
  submitAndResetForNext: () => Promise<boolean>;
  applyTemplate: (template: TransactionTemplate) => Promise<boolean>;
  saveCurrentAsTemplate: () => Promise<boolean>;
  /** True when any field changed since the form opened (master.md 8.4). */
  isDirty: () => boolean;
  isSubmitting: boolean;
}

export interface UseTransactionFormResult {
  state: TransactionFormState;
  actions: TransactionFormActions;
  wallets: Wallet[];
  categories: Category[];
  templates: TransactionTemplate[];
  transactions: Transaction[];
}

interface UseTransactionFormOptions {
  isOpen: boolean;
  txToEdit?: Transaction | null;
  initialType?: TransactionType;
  initialDescription?: string;
  initialFromWalletId?: number;
  initialToWalletId?: number;
  initialAmount?: string;
  initialNotes?: string;
  onClose: () => void;
  onConfirmCreateCategory: (name: string) => Promise<boolean>;
}

function getTransactionInitKey(tx: Transaction): string {
  return [
    tx.id ?? 'draft',
    tx.type,
    tx.walletId,
    tx.categoryId ?? 'none',
    tx.date,
    tx.amount,
    tx.description,
    tx.notes ?? '',
  ].join('|');
}

// ── Submit helpers (module scope keeps handleSubmit's complexity low) ──────

async function resolveCategoryIdForSubmit(
  name: string,
  categories: readonly Category[],
  onConfirmCreateCategory: (name: string) => Promise<boolean>,
): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existingCat = categories.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existingCat) return existingCat.id!;
  const confirmed = await onConfirmCreateCategory(name);
  if (!confirmed) return null;
  const foundCat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (foundCat) return foundCat.id!;
  // Friction audit B6: deterministic color — first unused palette entry
  // (sequential), not random, so new categories stay consistent and predictable.
  const usedColors = new Set(categories.map((c) => c.color));
  const available = CURATED_PALETTE.filter((c) => !usedColors.has(c));
  const color = available.length > 0 ? available[0]! : CURATED_PALETTE[0]!;
  const newId = await db.categories.add({ name, icon: 'Tag', color });
  return newId ?? null;
}

interface TransferSubmitContext {
  walletId: string;
  toWalletId: string;
  txToEdit?: Transaction | null;
  date: string;
  notes: string;
  t: (key: string) => string;
}

async function submitTransfer(
  ctx: TransferSubmitContext,
  rawAmount: number,
  trimmedDescription: string,
): Promise<boolean> {
  const fromId = Number.parseInt(ctx.walletId, 10);
  const toId = Number.parseInt(ctx.toWalletId, 10);
  if (fromId === toId) {
    toast.add(ctx.t('Cannot transfer to the same wallet.'));
    return false;
  }
  if (ctx.txToEdit?.id) {
    const groupId = ctx.txToEdit.transferGroupId;
    if (!groupId) {
      toast.add(ctx.t('Cannot edit this transfer.'));
      return false;
    }
    await updateTransfer({
      transferGroupId: groupId,
      amount: rawAmount,
      description: trimmedDescription,
      date: ctx.date,
      fromWalletId: fromId,
      toWalletId: toId,
      notes: ctx.notes,
    });
    return true;
  }
  await saveTransfer({
    amount: rawAmount,
    description: trimmedDescription,
    date: ctx.date,
    fromWalletId: fromId,
    toWalletId: toId,
    notes: ctx.notes,
  });
  return true;
}

interface ExpenseSubmitContext {
  categoryName: string;
  date: string;
  walletId: string;
  notes: string;
  txToEdit?: Transaction | null;
  categories: readonly Category[];
  onConfirmCreateCategory: (name: string) => Promise<boolean>;
}

async function submitExpense(
  ctx: ExpenseSubmitContext,
  rawAmount: number,
  trimmedDescription: string,
): Promise<void> {
  const catId = await resolveCategoryIdForSubmit(ctx.categoryName, ctx.categories, ctx.onConfirmCreateCategory);
  await saveTransaction(
    {
      amount: rawAmount,
      description: trimmedDescription,
      date: ctx.date,
      walletId: Number.parseInt(ctx.walletId, 10),
      categoryId: catId,
      notes: ctx.notes,
      type: ctx.txToEdit ? ctx.txToEdit.type : 'expense',
    },
    ctx.txToEdit?.id,
  );
  // Remember the wallet + category used for future suggestions
  const walletNum = Number.parseInt(ctx.walletId, 10);
  if (Number.isSafeInteger(walletNum)) {
    await rememberLastUsedWallet(walletNum);
  }
  if (catId != null) {
    await db.settings.put({ key: LAST_SELECTED_CATEGORY_KEY, value: catId });
  }
}



export function useTransactionForm({
  isOpen,
  txToEdit,
  initialType = 'expense',
  initialDescription,
  initialFromWalletId,
  initialToWalletId,
  initialAmount,
  initialNotes,
  onClose,
  onConfirmCreateCategory,
}: UseTransactionFormOptions): UseTransactionFormResult {
  const { t } = useTranslation();
  const queriedWallets = useLiveQuery(() => db.wallets.toArray());
  const queriedCategories = useLiveQuery(() => db.categories.toArray());
  const queriedMerchants = useLiveQuery(() => db.merchants.toArray());
  const queriedTransactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().limit(100).toArray()
  );
  const templates = useLiveQuery(() => getTemplates(), [], EMPTY_TEMPLATES);
  const wallets = queriedWallets ?? EMPTY_WALLETS;
  const categories = queriedCategories ?? EMPTY_CATEGORIES;
  const merchants = queriedMerchants ?? EMPTY_MERCHANTS;
  const transactions =
    queriedTransactions ?? EMPTY_TRANSACTIONS;

  const recentDescriptions = useMemo(() => {
    return Array.from(
      new Set(
        transactions
          .filter((t) => t.type !== 'balance_adjustment')
          .map((t) => t.description.replace(/\s\((In|Out)\)$/, ''))
      )
    );
  }, [transactions]);


  // Form state
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => getTodayStr());
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [notes, setNotes] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [showDescriptionSuggestions, setShowDescriptionSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initializedKeyRef = useRef<string | null>(null);
  const categoryTouchedRef = useRef(false);
  const lastSelectedCategoryIdRef = useRef<number | null>(null);

  // master.md 8.4: true once any field mutates after open; reset on init.
  const dirtyRef = useRef(false);
  const markDirty = <A extends unknown[], R>(fn: (...args: A) => R): ((...args: A) => R) =>
    (...args: A) => { dirtyRef.current = true; return fn(...args); };

  // master.md 8.4: only a fresh open resets the dirty flag. The init effect
  // also re-runs on async data loads (categories/transactions), which must
  // not wipe a user's unsaved edits.
  const prevOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) dirtyRef.current = false;
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // Filter description suggestions
  const [filteredDescriptionSuggestions, setFilteredDescriptionSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const query = description.toLowerCase().trim();
    setFilteredDescriptionSuggestions(
      (query
        ? recentDescriptions.filter(item => item.toLowerCase().includes(query))
        : recentDescriptions
      ).slice(0, 5)
    );
  }, [description, recentDescriptions]);

  // Load the last selected category for suggestion fallback
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    db.settings.get(LAST_SELECTED_CATEGORY_KEY).then((entry) => {
      if (active && typeof entry?.value === 'number') {
        lastSelectedCategoryIdRef.current = entry.value;
      }
    });
    return () => { active = false; };
  }, [isOpen]);

  // Suggest a category from local history while typing (never overrides a
  // category the user picked manually — see master.md 5.3).
  useEffect(() => {
    if (!isOpen || type !== 'expense' || txToEdit) return;
    if (categoryTouchedRef.current) return;
    const suggestion = suggestCategoryForPayee(
      description,
      transactions,
      categories,
      merchants,
      lastSelectedCategoryIdRef.current,
    );
    if (suggestion.categoryName) {
      setCategoryName(suggestion.categoryName);
    }
  }, [description, isOpen, type, txToEdit, transactions, categories, merchants]);

  // Initialize form when opened or txToEdit changes
  useEffect(() => {
    function initEditFields(editTx: NonNullable<typeof txToEdit>): void {
      setAmount(numberToAmountInput(editTx.amount));
      setDescription(editTx.description.replace(/\s\((In|Out)\)$/, ''));
      setWalletId(editTx.walletId.toString());
      setDate(editTx.date.split('T')[0] ?? '');
      setNotes(editTx.notes || '');
      categoryTouchedRef.current = true;

      if (editTx.type === 'expense' || editTx.type === 'balance_adjustment') {
        setType('expense');
      } else {
        setType('transfer');
        // Resolve source + destination from the transfer pair so both wallet
        // fields are prefilled correctly (master.md 5.6).
        if (editTx.transferGroupId) {
          void findPairedTransfer(editTx).then((paired) => {
            const outSide = editTx.type === 'transfer_out' ? editTx : paired;
            const inSide = editTx.type === 'transfer_in' ? editTx : paired;
            if (outSide?.id && inSide?.id) {
              setWalletId(outSide.walletId.toString());
              setToWalletId(inSide.walletId.toString());
            }
          });
        }
      }

      const cat = categories.find((c) => c.id === editTx.categoryId);
      setCategoryName(cat ? cat.name : '');
    }

    async function initNewFields(): Promise<void> {
      setAmount(initialAmount ?? '');
      setDescription(initialDescription ?? '');
      setDate(getTodayStr());
      setNotes(initialNotes ?? '');
      setToWalletId(initialToWalletId ? initialToWalletId.toString() : '');
      setCategoryName('');
      setType(initialType);
      categoryTouchedRef.current = false;

      // Default wallet preference (master.md 5.2): explicit initial wins,
      // otherwise configured > last-used > first active.
      if (initialFromWalletId) {
        setWalletId(initialFromWalletId.toString());
      } else {
        const defaultWallet = await getDefaultExpenseWallet(wallets);
        setWalletId(defaultWallet?.id ? defaultWallet.id.toString() : '');
      }
    }

    if (!isOpen) {
      initializedKeyRef.current = null;
      return;
    }

    const initKey = txToEdit ? `edit:${getTransactionInitKey(txToEdit)}` : `new:${initialType}:${initialDescription ?? ''}:${initialAmount ?? ''}:${initialFromWalletId ?? ''}:${initialToWalletId ?? ''}`;
    if (initializedKeyRef.current !== initKey) {
      initializedKeyRef.current = initKey;

      if (txToEdit) {
        initEditFields(txToEdit);
      } else {
        void initNewFields();
      }
    }
  }, [isOpen, txToEdit, categories, wallets, initialType, initialDescription, initialFromWalletId, initialToWalletId, initialAmount, initialNotes]);

  // Fix stale walletId when wallets load after form opens. Respects the
  // default wallet preference fallback order (master.md 5.2) rather than
  // blindly selecting the first wallet.
  useEffect(() => {
    if (isOpen && !txToEdit && !walletId && wallets.length > 0) {
      void getDefaultExpenseWallet(wallets).then((defaultWallet) => {
        // Only fill when still empty (user may have picked one meanwhile)
        setWalletId((current) => current || (defaultWallet?.id?.toString() ?? ''));
      });
    }
  }, [isOpen, wallets, walletId, txToEdit]);

  // Auto-select destination wallet
  useEffect(() => {
    if (type !== 'transfer' || !walletId) return;
    const sourceId = Number.parseInt(walletId, 10);
    if (toWalletId) {
      const targetId = Number.parseInt(toWalletId, 10);
      if (targetId !== sourceId && wallets.some((w) => w.id === targetId)) {
        return;
      }
    }
    const otherWallet = wallets.find((w) => w.id !== sourceId);
    if (otherWallet?.id) {
      setToWalletId(otherWallet.id.toString());
    }
  }, [type, walletId, wallets, toWalletId]);

  // Sync category name when categories load for edit
  useEffect(() => {
    if (!isOpen || !txToEdit || type === 'transfer') return;
    if (!categoryName && txToEdit.categoryId) {
      const cat = categories.find((c) => c.id === txToEdit.categoryId);
      if (cat) setCategoryName(cat.name);
    }
  }, [isOpen, txToEdit, categories, categoryName, type]);

  const handleAmountChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setAmount(sanitizeAmountInput(e.target.value));
  }, []);

  // Manual category selection is never overridden by suggestions
  const handleSetCategoryName = useCallback((name: string) => {
    categoryTouchedRef.current = true;
    setCategoryName(name);
  }, []);

  const applyTemplate = useCallback(async (template: TransactionTemplate): Promise<boolean> => {
    const resolved = await resolveTemplate(template, { wallets, categories });
    if (!resolved) return false;
    setType('expense');
    if (resolved.amount != null) setAmount(numberToAmountInput(resolved.amount));
    if (resolved.description) setDescription(resolved.description);
    if (resolved.notes) setNotes(resolved.notes);
    if (resolved.walletId != null) setWalletId(resolved.walletId.toString());
    if (resolved.categoryId != null) {
      const cat = categories.find((c) => c.id === resolved.categoryId);
      if (cat) {
        categoryTouchedRef.current = true;
        setCategoryName(cat.name);
      }
    }
    return true;
  }, [wallets, categories]);

  const saveCurrentAsTemplate = useCallback(async (): Promise<boolean> => {
    const templateName = description.trim() || categoryName.trim();
    if (!templateName) {
      toast.add(t('Enter a description or category to save as a template.'));
      return false;
    }
    const matchedCat = categories.find(
      (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
    );
    const amountNum = amount ? parseAmountToNumber(amount) : undefined;
    const walletNum = walletId ? Number.parseInt(walletId, 10) : undefined;
    await saveTemplate({
      name: templateName,
      amount: amountNum,
      categoryId: matchedCat?.id,
      walletId: walletNum,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    toast.add(t('Template saved'));
    return true;
  }, [description, categoryName, categories, amount, walletId, notes, t]);

  const performSubmit = useCallback(async (): Promise<boolean> => {
    if (!amount || !date || !walletId) return false;
    if (type === 'transfer' && !toWalletId) return false;

    const rawAmount = parseAmountToNumber(amount);
    // Quick Add may omit the payee — fall back to the chosen category name.
    const trimmedDescription = description.trim() || categoryName.trim();
    if (!trimmedDescription) {
      toast.add(t('Enter a description or category'));
      return false;
    }

    setIsSubmitting(true);
    try {
      let success: boolean;
      if (type === 'transfer') {
        success = await submitTransfer(
          { walletId, toWalletId, txToEdit, date, notes, t },
          rawAmount,
          trimmedDescription,
        );
      } else {
        const duplicate = findRecentDuplicate(transactions, {
          amount: rawAmount, description: trimmedDescription, date,
        });
        if (duplicate) {
          const ok = await confirm({
            title: t('form.duplicateTitle'),
            message: t('form.duplicateMessage'),
            confirmLabel: t('form.duplicateConfirm'),
            cancelLabel: t('form.duplicateCancel'),
            variant: 'danger',
          });
          if (!ok) return false;
        }
        await submitExpense(
          { categoryName, date, walletId, notes, txToEdit, categories, onConfirmCreateCategory },
          rawAmount,
          trimmedDescription,
        );
        success = true;
      }

      if (!success) return false;

      if (navigator.vibrate) navigator.vibrate(50);
      return true;
    } catch (err) {
      if (err instanceof Error && err.message === INSUFFICIENT_WALLET_BALANCE_MESSAGE) {
        toast.add(t(INSUFFICIENT_WALLET_BALANCE_MESSAGE));
      } else {
        toast.add(t('Action failed'));
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    amount, description, date, walletId, toWalletId, type,
    categoryName, notes, txToEdit, categories, transactions,
    onConfirmCreateCategory, t,
  ]);

  // Friction A8: save + close (default), or save + stay open for the next entry.
  const handleSubmit = useCallback(async (): Promise<boolean> => {
    const ok = await performSubmit();
    if (ok) onClose();
    return ok;
  }, [performSubmit, onClose]);

  const resetForNextEntry = useCallback((): void => {
    setAmount('');
    setDescription('');
    setNotes('');
    dirtyRef.current = false;
  }, []);

  const submitAndResetForNext = useCallback(async (): Promise<boolean> => {
    const ok = await performSubmit();
    if (ok) resetForNextEntry();
    return ok;
  }, [performSubmit, resetForNextEntry]);

  return {
    state: {
      type, amount, description, date, walletId, toWalletId,
      categoryName, notes, isAmountFocused, showDescriptionSuggestions,
      filteredDescriptionSuggestions,
    },
    actions: {
      // master.md 8.4: every field mutation marks the form dirty so the
      // close handler can guard against discarding unsaved changes.
      setType: markDirty(setType), setAmount: markDirty(setAmount),
      setDescription: markDirty(setDescription), setDate: markDirty(setDate),
      setWalletId: markDirty(setWalletId), setToWalletId: markDirty(setToWalletId),
      setCategoryName: markDirty(handleSetCategoryName), setNotes: markDirty(setNotes),
      handleAmountChange: markDirty(handleAmountChange),
      applyTemplate: markDirty(applyTemplate),
      setIsAmountFocused,
      setShowDescriptionSuggestions, handleSubmit,
      submitAndResetForNext,
      saveCurrentAsTemplate,
      isDirty: () => dirtyRef.current,
      isSubmitting,
    },
    wallets,
    categories,
    templates,
    transactions,
  };
}
