import { useState, useEffect, useMemo, useRef, useCallback, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction, type Wallet, type Category } from '../db/db';
import { saveTransaction, saveTransfer } from '../services/transactionSaveService';
import { resolveCategory } from '../services/categoryService';

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
  onClose: () => void;
  onConfirmCreateCategory: (name: string) => Promise<boolean>;
}

export function useTransactionForm({
  isOpen,
  txToEdit,
  onClose,
  onConfirmCreateCategory,
}: UseTransactionFormOptions): UseTransactionFormResult {
  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const transactions =
    useLiveQuery(
      () => db.transactions.orderBy('date').reverse().limit(100).toArray()
    ) || [];

  const recentDescriptions = useMemo(() => {
    return Array.from(
      new Set(transactions.map((t) => t.description.replace(/\s\((In|Out)\)$/, '')))
    ).slice(0, 100);
  }, [transactions]);

  // Form state
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0] ?? '');
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [notes, setNotes] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [showDescriptionSuggestions, setShowDescriptionSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initializedRef = useRef(false);

  // Filter description suggestions
  const filteredDescriptionSuggestions = useMemo(() => {
    if (!description.trim()) return recentDescriptions.slice(0, 5);
    const lower = description.toLowerCase();
    return recentDescriptions
      .filter((d) => d.toLowerCase().includes(lower))
      .slice(0, 5);
  }, [description, recentDescriptions]);

  // Initialize form when opened or txToEdit changes
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      return;
    }
    if (!initializedRef.current || txToEdit) {
      initializedRef.current = true;
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
        setDescription('');
        setDate(new Date().toISOString().split('T')[0] ?? '');
        setWalletId(
          wallets.length > 0 ? wallets[0]!.id!.toString() : ''
        );
        setToWalletId('');
        setCategoryName('');
        setNotes('');
        setType('expense');
      }
    }
  }, [isOpen, txToEdit, categories, wallets]);

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
          return false;
        }
        if (txToEdit && txToEdit.id) {
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
            catId = await resolveCategory(categoryName.trim(), categories);
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
    } catch {
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    amount, description, date, walletId, toWalletId, type,
    categoryName, notes, txToEdit, categories, onClose,
    onConfirmCreateCategory,
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
