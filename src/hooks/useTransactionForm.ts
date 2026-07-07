import { useState, useEffect, useMemo, useRef, useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction, type Wallet, type Category } from '../db/db';
import { INSUFFICIENT_WALLET_BALANCE_MESSAGE, saveTransaction, saveTransfer } from '../services/transactionSaveService';
import { CURATED_PALETTE } from '../utils/constants';
import { getTodayStr } from '../utils/dateUtils';
import { toast } from '../components/Toaster';

const EMPTY_WALLETS: Wallet[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_TRANSACTIONS: Transaction[] = [];

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
  isSubmitting: boolean;
}

export interface UseTransactionFormResult {
  state: TransactionFormState;
  actions: TransactionFormActions;
  wallets: Wallet[];
  categories: Category[];
}

interface UseTransactionFormOptions {
  isOpen: boolean;
  txToEdit?: Transaction | null;
  initialType?: TransactionType;
  initialDescription?: string;
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
  onClose,
  onConfirmCreateCategory,
}: UseTransactionFormOptions): UseTransactionFormResult {
  const { t } = useTranslation();
  const queriedWallets = useLiveQuery(() => db.wallets.toArray());
  const queriedCategories = useLiveQuery(() => db.categories.toArray());
  const queriedTransactions = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().limit(100).toArray()
  );
  const wallets = queriedWallets ?? EMPTY_WALLETS;
  const categories = queriedCategories ?? EMPTY_CATEGORIES;
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

  // Initialize form when opened or txToEdit changes
  useEffect(() => {
    if (!isOpen) {
      initializedKeyRef.current = null;
      return;
    }

    const initKey = txToEdit ? `edit:${getTransactionInitKey(txToEdit)}` : `new:${initialType}:${initialDescription ?? ''}`;
    if (initializedKeyRef.current !== initKey) {
      initializedKeyRef.current = initKey;

      if (txToEdit) {
        setAmount(txToEdit.amount.toString());
        setDescription(txToEdit.description);
        setWalletId(txToEdit.walletId.toString());
        setDate(txToEdit.date.split('T')[0] ?? '');
        setNotes(txToEdit.notes || '');

        if (
          txToEdit.type === 'expense' ||
          txToEdit.type === 'balance_adjustment'
        )
          setType('expense');
        else if (
          txToEdit.type === 'transfer_out' ||
          txToEdit.type === 'transfer_in'
        )
          setType('transfer');
        else setType('expense');

        const cat = categories.find((c) => c.id === txToEdit.categoryId);
        setCategoryName(cat ? cat.name : '');
      } else {
        setAmount('');
        setDescription(initialDescription ?? '');
        setDate(getTodayStr());
        setWalletId(
          wallets.length > 0 ? wallets[0]!.id!.toString() : ''
        );
        setToWalletId('');
        setCategoryName('');
        setNotes('');
        setType(initialType);
      }
    }
  }, [isOpen, txToEdit, categories, wallets, initialType, initialDescription]);

  // Fix stale walletId when wallets load after form opens
  useEffect(() => {
    if (isOpen && !txToEdit && !walletId && wallets.length > 0) {
      setWalletId(wallets[0]!.id!.toString());
    }
  }, [isOpen, wallets, walletId, txToEdit]);

  // Auto-select destination wallet
  useEffect(() => {
    if (type !== 'transfer' || !walletId) return;
    const sourceId = parseInt(walletId, 10);
    if (toWalletId) {
      const targetId = parseInt(toWalletId, 10);
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
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    if (!rawValue) {
      setAmount('');
      return;
    }
    setAmount(parseInt(rawValue, 10).toLocaleString('id-ID'));
  }, []);

  const handleSubmit = useCallback(async (): Promise<boolean> => {
    if (!amount || !description || !date || !walletId) return false;
    if (type === 'transfer' && !toWalletId) return false;

    const rawAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    const trimmedDescription = description.trim();

    setIsSubmitting(true);
    try {
      if (type === 'transfer') {
        if (parseInt(walletId, 10) === parseInt(toWalletId, 10)) {
          toast.add(t('Cannot transfer to the same wallet.'));
          return false;
        }
        if (txToEdit && txToEdit.id) {
          toast.add(t('Editing transfers is not supported in this version.'));
          return false;
        }

        await saveTransfer({
          amount: rawAmount,
          description: trimmedDescription,
          date,
          fromWalletId: parseInt(walletId, 10),
          toWalletId: parseInt(toWalletId, 10),
          notes,
        });
      } else {
        let catId: number | null = null;
        if (categoryName.trim()) {
          const existingCat = categories.find(
            (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
          );
          if (existingCat) {
            catId = existingCat.id!;
          } else {
            const confirmed = await onConfirmCreateCategory(categoryName.trim());
            if (!confirmed) return false;
            catId = await (async (name: string): Promise<number | null> => {
              const existingCat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
              if (existingCat) return existingCat.id!;
              const usedColors = categories.map((c) => c.color);
              const available = CURATED_PALETTE.filter((c) => !usedColors.includes(c));
              const color = available.length > 0
                ? available[Math.floor(Math.random() * available.length)]!
                : CURATED_PALETTE[Math.floor(Math.random() * CURATED_PALETTE.length)]!;
              const newId = await db.categories.add({ name, icon: '🏷️', color });
              return newId ?? null;
            })(categoryName.trim());
          }
        }

        await saveTransaction(
          {
            amount: rawAmount,
            description: trimmedDescription,
            date,
            walletId: parseInt(walletId, 10),
            categoryId: catId,
            notes,
            type: txToEdit ? txToEdit.type : 'expense',
          },
          txToEdit?.id
        );
      }

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
      setToWalletId, setCategoryName, setNotes, setIsAmountFocused,
      setShowDescriptionSuggestions, handleAmountChange, handleSubmit,
      isSubmitting,
    },
    wallets,
    categories,
  };
}
