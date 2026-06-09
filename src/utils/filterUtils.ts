import { Transaction, Category, Wallet } from '../db/db';

export interface FilterCriteria {
  type: 'all' | 'expense' | 'balance_adjustment';
  categories: number[];
  wallets: number[];
  searchTerm: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  /** Category map for searching by category name */
  categoryMap?: Record<number, Category>;
  /** Wallet map for searching by wallet name */
  walletMap?: Record<number, Wallet>;
}

export function filterTransactions(transactions: Transaction[], criteria: FilterCriteria): Transaction[] {
  const { 
    type, 
    categories, 
    wallets, 
    searchTerm, 
    startDate, 
    endDate, 
    minAmount, 
    maxAmount,
    categoryMap,
    walletMap
  } = criteria;

  const normalizedSearch = searchTerm?.toLowerCase().trim();

  return transactions.filter(tx => {
    const typeMatch = type === 'all' || tx.type === type;
    const categoryMatch = categories.length === 0 || (tx.categoryId != null && categories.includes(tx.categoryId));
    const walletMatch = wallets.length === 0 || (tx.walletId != null && wallets.includes(tx.walletId));
    
    const searchMatch = !normalizedSearch || 
      tx.description.toLowerCase().includes(normalizedSearch) || 
      (tx.notes && tx.notes.toLowerCase().includes(normalizedSearch)) ||
      // Search by category name
      (!!tx.categoryId && !!categoryMap?.[tx.categoryId]?.name && 
        categoryMap[tx.categoryId]!.name.toLowerCase().includes(normalizedSearch)) ||
      // Search by wallet name
      (!!walletMap?.[tx.walletId]?.name && 
        walletMap[tx.walletId]!.name.toLowerCase().includes(normalizedSearch));
    
    let dateMatch = true;
    const txDate = tx.date.includes('T') ? tx.date.split('T')[0]! : tx.date;
    if (startDate) {
      dateMatch = dateMatch && txDate >= startDate;
    }
    if (endDate) {
      dateMatch = dateMatch && txDate <= endDate;
    }

    let amountMatch = true;
    const absAmount = Math.abs(tx.amount);
    if (minAmount && minAmount !== '') {
      amountMatch = amountMatch && absAmount >= parseInt(minAmount, 10);
    }
    if (maxAmount && maxAmount !== '') {
      amountMatch = amountMatch && absAmount <= parseInt(maxAmount, 10);
    }

    return typeMatch && categoryMatch && walletMatch && searchMatch && dateMatch && amountMatch;
  });
}
