import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getTodayStr, getWeekStartStr, normaliseDate } from '../utils/dateUtils';
import type { Transaction, Category, Wallet } from '../db/db';

export interface FilterState {
  type: 'all' | 'expense' | 'balance_adjustment';
  categories: number[];
  wallets: number[];
  searchTerm: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  quickFilter: 'today' | 'week' | 'transfers' | null;
}

export interface FilterActions {
  setType: (val: FilterState['type']) => void;
  setCategories: (val: number[]) => void;
  setWallets: (val: number[]) => void;
  setSearchTerm: (val: string) => void;
  setStartDate: (val: string) => void;
  setEndDate: (val: string) => void;
  setMinAmount: (val: string) => void;
  setMaxAmount: (val: string) => void;
  setQuickFilter: (val: FilterState['quickFilter']) => void;
  clearAllFilters: () => void;
}

export interface UseTransactionFiltersResult {
  filters: FilterState;
  actions: FilterActions;
  filteredTransactions: Transaction[];
  hasActiveFilters: boolean;
  searchRef: React.RefObject<HTMLInputElement | null>;
  activeCategories: Category[];
  activeWallets: Wallet[];
}

export function useTransactionFilters(
  transactions: Transaction[] | undefined,
  allCategories: Category[] | undefined,
  allWallets: Wallet[] | undefined,
): UseTransactionFiltersResult {
  const [type, setType] = useState<FilterState['type']>('all');
  const [categories, setCategories] = useState<number[]>([]);
  const [wallets, setWallets] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [quickFilter, setQuickFilter] = useState<FilterState['quickFilter']>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search term
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm]);

  const categoryMap = useMemo(() => {
    if (!allCategories) return {};
    return allCategories.reduce((acc, cat) => {
      if (cat.id != null) acc[cat.id] = cat;
      return acc;
    }, {} as Record<number, Category>);
  }, [allCategories]);

  const walletMap = useMemo(() => {
    if (!allWallets) return {};
    return allWallets.reduce((acc, w) => {
      if (w.id != null) acc[w.id] = w;
      return acc;
    }, {} as Record<number, Wallet>);
  }, [allWallets]);

  // Reset quick filter when advanced filters change
  useEffect(() => {
    if (quickFilter && (type !== 'all' || categories.length > 0 || wallets.length > 0 || minAmount || maxAmount || startDate || endDate)) {
      setQuickFilter(null);
    }
  }, [quickFilter, type, categories, wallets, minAmount, maxAmount, startDate, endDate]);

  const clearAllFilters = useCallback(() => {
    setType('all');
    setCategories([]);
    setWallets([]);
    setMinAmount('');
    setMaxAmount('');
    setStartDate('');
    setEndDate('');
    setQuickFilter(null);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return type !== 'all' ||
      categories.length > 0 ||
      wallets.length > 0 ||
      minAmount !== '' ||
      maxAmount !== '' ||
      startDate !== '' ||
      endDate !== '' ||
      searchTerm !== '' ||
      quickFilter !== null;
  }, [type, categories, wallets, minAmount, maxAmount, startDate, endDate, searchTerm, quickFilter]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    const normalizedSearch = debouncedSearchTerm.toLowerCase().trim();
    let results = transactions.filter(tx => {
      const txDate = normaliseDate(tx.date);
      const absAmount = Math.abs(tx.amount);
      const minParsed = minAmount ? parseInt(minAmount, 10) : NaN;
      const maxParsed = maxAmount ? parseInt(maxAmount, 10) : NaN;

      return (type === 'all' || tx.type === type) &&
        (categories.length === 0 || (tx.categoryId != null && categories.includes(tx.categoryId))) &&
        (wallets.length === 0 || wallets.includes(tx.walletId)) &&
        (!startDate || txDate >= startDate) &&
        (!endDate || txDate <= endDate) &&
        (!Number.isFinite(minParsed) || absAmount >= minParsed) &&
        (!Number.isFinite(maxParsed) || absAmount <= maxParsed) &&
        (!normalizedSearch ||
          tx.description.toLowerCase().includes(normalizedSearch) ||
          (tx.notes?.toLowerCase().includes(normalizedSearch) ?? false) ||
          (!!tx.categoryId && (categoryMap[tx.categoryId]?.name.toLowerCase().includes(normalizedSearch) ?? false)) ||
          (walletMap[tx.walletId]?.name.toLowerCase().includes(normalizedSearch) ?? false));
    });

    // Apply quick filter on top of existing filters
    if (quickFilter) {
      if (quickFilter === 'today') {
        const todayStr = getTodayStr();
        results = results.filter(tx => normaliseDate(tx.date) === todayStr);
      } else if (quickFilter === 'week') {
        const weekStartStr = getWeekStartStr();
        results = results.filter(tx => normaliseDate(tx.date) >= weekStartStr);
      } else if (quickFilter === 'transfers') {
        results = results.filter(tx => tx.type === 'transfer_in' || tx.type === 'transfer_out');
      }
    }

    return results;
  }, [transactions, type, categories, wallets, debouncedSearchTerm, startDate, endDate, minAmount, maxAmount, categoryMap, walletMap, quickFilter]);

  // Get only categories and wallets that are actually used in transactions
  const activeCategories = useMemo(() => {
    if (!allCategories || !transactions) return [];
    const usedCategoryIds = new Set(transactions.map(tx => tx.categoryId).filter(id => id !== null));
    return allCategories.filter(cat => cat.id != null && usedCategoryIds.has(cat.id));
  }, [allCategories, transactions]);

  const activeWallets = useMemo(() => {
    if (!allWallets || !transactions) return [];
    const usedWalletIds = new Set(transactions.map(tx => tx.walletId));
    return allWallets.filter(w => w.id != null && usedWalletIds.has(w.id));
  }, [allWallets, transactions]);

  return {
    filters: { type, categories, wallets, searchTerm, startDate, endDate, minAmount, maxAmount, quickFilter },
    actions: {
      setType,
      setCategories,
      setWallets,
      setSearchTerm,
      setStartDate,
      setEndDate,
      setMinAmount,
      setMaxAmount,
      setQuickFilter,
      clearAllFilters,
    },
    filteredTransactions,
    hasActiveFilters,
    searchRef,
    activeCategories,
    activeWallets,
  };
}
