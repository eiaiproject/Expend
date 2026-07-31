import { useState, useEffect, useMemo, useRef, useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction, type Wallet, type Category, type Merchant } from '../db/db';
import { INSUFFICIENT_WALLET_BALANCE_MESSAGE, saveTransaction, saveTransfer, updateTransfer } from '../services/transactionSaveService';
import { CURATED_PALETTE } from '../utils/constants';
import { getTodayStr } from '../utils/dateUtils';
import { toast } from '../components/Toaster';
import { findPairedTransfer } from '../utils/transferUtils';
import { getDefaultExpenseWallet, rememberLastUsedWallet } from '../services/walletPreferenceService';
import { rankPayees, suggestCategoryForPayee, type PayeeRankingItem } from '../services/categorySuggestionService';
import { getFavoritePayeeKeys } from '../services/payeeFavoritesService';
import { normalizePayeeKey, normalizePayeeName } from '../services/payeeService';
import { getTemplates, resolveTemplate, saveTemplate, type TransactionTemplate } from '../services/templateService';

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
  applyTemplate: (template: TransactionTemplate) => Promise<boolean>;
  saveCurrentAsTemplate: () => Promise<boolean>;
  applyPayee: (payeeName: string) => void;
  isSubmitting: boolean;
}

export interface UseTransactionFormResult {
  state: TransactionFormState;
  actions: TransactionFormActions;
  wallets: Wallet[];
  categories: Category[];
  templates: TransactionTemplate[];
  frequentPayees: PayeeRankingItem[];
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
  const favoritePayeeKeys = useLiveQuery(() => getFavoritePayeeKeys(), [], []);
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

  // Frequently used payees for Quick Add (master.md 6.2) — deterministic
  // local ranking: frequency + 7-day recency bonus + favorite bonus.
  // Archived or invalid merchants are excluded from suggestions (6.2).
  const frequentPayees = useMemo<PayeeRankingItem[]>(() => {
    const archivedKeys = new Set(
      merchants.filter((m) => m.archivedAt).map((m) => normalizePayeeKey(m.displayName))
    );
    return rankPayees(transactions, new Set(favoritePayeeKeys))
      .filter((item) => !archivedKeys.has(item.key));
  }, [transactions, favoritePayeeKeys, merchants]);

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
    const trimmed = description.trim();
    if (!trimmed || categoryTouchedRef.current) return;
    const suggestion = suggestCategoryForPayee(
      trimmed,
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
      setAmount(editTx.amount.toString());
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
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      setAmount('');
      return;
    }
    setAmount(Number.parseInt(rawValue, 10).toLocaleString('id-ID'));
  }, []);

  // Manual category selection is never overridden by suggestions
  const handleSetCategoryName = useCallback((name: string) => {
    categoryTouchedRef.current = true;
    setCategoryName(name);
  }, []);

  // Select a frequently used payee (master.md 6.3): fill the payee field,
  // suggest its most recent/most common category, and suggest its last-used
  // valid wallet. The amount stays empty unless a template defines it.
  const applyPayee = useCallback((payeeName: string) => {
    const name = normalizePayeeName(payeeName);
    if (!name) return;
    // Preserve a category the user picked manually (master.md 5.3 — never
    // silently override a manual selection). Only allow suggestion prefill
    // when no manual pick exists, so the description-suggestion effect also
    // bails on the manual-pick path.
    const manualCategoryPick = categoryTouchedRef.current;
    setDescription(name);
    if (!manualCategoryPick) categoryTouchedRef.current = false;

    const key = normalizePayeeKey(name);
    // Most recent matching expense → most common category + last-used wallet
    const payeeTxs = transactions.filter(
      (t) => t.type === 'expense' && normalizePayeeKey(t.description) === key
    );
    if (payeeTxs.length > 0) {
      // Last-used valid wallet (most recent first, active wallet only)
      const sorted = [...payeeTxs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      const lastWallet = wallets.find((w) => w.id === sorted[0]?.walletId && !w.archivedAt);
      if (lastWallet?.id) setWalletId(lastWallet.id.toString());

      // Most common category for the payee
      const counts = new Map<number, number>();
      for (const t of payeeTxs) {
        if (t.categoryId != null) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
      }
      let bestId: number | null = null;
      let bestCount = 0;
      for (const [id, count] of counts.entries()) {
        if (count > bestCount) { bestId = id; bestCount = count; }
      }
      const cat = bestId != null ? categories.find((c) => c.id === bestId) : undefined;
      if (cat && !manualCategoryPick) {
        categoryTouchedRef.current = true;
        setCategoryName(cat.name);
      }
    }
  }, [transactions, wallets, categories]);

  const applyTemplate = useCallback(async (template: TransactionTemplate): Promise<boolean> => {
    const resolved = await resolveTemplate(template, { wallets, categories });
    if (!resolved) return false;
    setType('expense');
    if (resolved.amount != null) setAmount(resolved.amount.toLocaleString('id-ID'));
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
    const amountNum = amount ? Number.parseInt(amount.replace(/\D/g, ''), 10) : undefined;
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

  const handleSubmit = useCallback(async (): Promise<boolean> => {
    async function resolveCategoryId(name: string): Promise<number | null> {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existingCat = categories.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existingCat) return existingCat.id!;
      const confirmed = await onConfirmCreateCategory(name);
      if (!confirmed) return null;
      const foundCat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (foundCat) return foundCat.id!;
      const usedColors = new Set(categories.map((c) => c.color));
      const available = CURATED_PALETTE.filter((c) => !usedColors.has(c));
      const color = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]!  // NOSONAR typescript:S2245 — design color selection, not security
        : CURATED_PALETTE[Math.floor(Math.random() * CURATED_PALETTE.length)]!;  // NOSONAR typescript:S2245 — design color selection, not security
      const newId = await db.categories.add({ name, icon: '🏷️', color });
      return newId ?? null;
    }

    async function handleTransferSubmit(
      rawAmount: number,
      trimmedDescription: string
    ): Promise<boolean> {
      const fromId = Number.parseInt(walletId, 10);
      const toId = Number.parseInt(toWalletId, 10);
      if (fromId === toId) {
        toast.add(t('Cannot transfer to the same wallet.'));
        return false;
      }
      if (txToEdit?.id) {
        const groupId = txToEdit.transferGroupId;
        if (!groupId) {
          toast.add(t('Cannot edit this transfer.'));
          return false;
        }
        await updateTransfer({
          transferGroupId: groupId,
          amount: rawAmount,
          description: trimmedDescription,
          date,
          fromWalletId: fromId,
          toWalletId: toId,
          notes,
        });
        return true;
      }
      await saveTransfer({
        amount: rawAmount,
        description: trimmedDescription,
        date,
        fromWalletId: fromId,
        toWalletId: toId,
        notes,
      });
      return true;
    }

    async function handleExpenseSubmit(
      rawAmount: number,
      trimmedDescription: string
    ): Promise<void> {
      const catId = await resolveCategoryId(categoryName);
      await saveTransaction(
        {
          amount: rawAmount,
          description: trimmedDescription,
          date,
          walletId: Number.parseInt(walletId, 10),
          categoryId: catId,
          notes,
          type: txToEdit ? txToEdit.type : 'expense',
        },
        txToEdit?.id
      );
      // Remember the wallet + category used for future suggestions
      const walletNum = Number.parseInt(walletId, 10);
      if (Number.isSafeInteger(walletNum)) {
        await rememberLastUsedWallet(walletNum);
      }
      if (catId != null) {
        await db.settings.put({ key: LAST_SELECTED_CATEGORY_KEY, value: catId });
      }
    }

    if (!amount || !date || !walletId) return false;
    if (type === 'transfer' && !toWalletId) return false;

    const rawAmount = Number.parseInt(amount.replace(/\D/g, ''), 10);
    // Quick Add may omit the payee — fall back to the chosen category name.
    const trimmedDescription = description.trim() || categoryName.trim();
    if (!trimmedDescription) {
      toast.add(t('Enter a description or category'));
      return false;
    }

    setIsSubmitting(true);
    try {
      const success = type === 'transfer'
        ? await handleTransferSubmit(rawAmount, trimmedDescription)
        : (await handleExpenseSubmit(rawAmount, trimmedDescription), true);

      if (!success) return false;

      if (navigator.vibrate) navigator.vibrate(50);
      onClose();
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
    categoryName, notes, txToEdit, categories, onClose,
    onConfirmCreateCategory, t,
  ]);

  return {
    state: {
      type, amount, description, date, walletId, toWalletId,
      categoryName, notes, isAmountFocused, showDescriptionSuggestions,
      filteredDescriptionSuggestions,
    },
    actions: {
      setType, setAmount, setDescription, setDate, setWalletId,
      setToWalletId, setCategoryName: handleSetCategoryName, setNotes, setIsAmountFocused,
      setShowDescriptionSuggestions, handleAmountChange, handleSubmit,
      applyTemplate, saveCurrentAsTemplate, applyPayee,
      isSubmitting,
    },
    wallets,
    categories,
    templates,
    frequentPayees,
  };
}
