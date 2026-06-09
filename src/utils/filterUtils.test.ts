import { describe, it, expect } from 'vitest';
import { filterTransactions, FilterCriteria } from './filterUtils';
import { Transaction } from '../db/db';

describe('filterTransactions', () => {
  const mockTransactions: Transaction[] = [
    { id: 1, amount: 1000, description: 'Lunch', date: '2023-10-01T10:00:00.000Z', walletId: 1, categoryId: 1, type: 'expense' },
    { id: 2, amount: 2000, description: 'Dinner', date: '2023-10-02T10:00:00.000Z', walletId: 1, categoryId: 2, type: 'expense' },
    { id: 3, amount: 500, description: 'Bus', date: '2023-10-03T10:00:00.000Z', walletId: 2, categoryId: 3, type: 'expense' },
    { id: 4, amount: 5000, description: 'Adjustment', date: '2023-10-04T10:00:00.000Z', walletId: 1, categoryId: null, type: 'balance_adjustment' },
  ];

  const defaultCriteria: FilterCriteria = {
    type: 'all',
    categories: [],
    wallets: [],
    searchTerm: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
  };

  it('should return all transactions when criteria are empty', () => {
    const result = filterTransactions(mockTransactions, defaultCriteria);
    expect(result).toHaveLength(4);
  });

  it('should filter by type', () => {
    const result = filterTransactions(mockTransactions, { ...defaultCriteria, type: 'expense' });
    expect(result).toHaveLength(3);
    expect(result.every(t => t.type === 'expense')).toBe(true);
  });

  it('should filter by multiple categories', () => {
    const result = filterTransactions(mockTransactions, { ...defaultCriteria, categories: [1, 2] });
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toContain(1);
    expect(result.map(t => t.id)).toContain(2);
  });

  it('should filter by multiple wallets', () => {
    const result = filterTransactions(mockTransactions, { ...defaultCriteria, wallets: [2] });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(3);
  });

  it('should filter by amount range', () => {
    const result = filterTransactions(mockTransactions, { ...defaultCriteria, minAmount: '1000', maxAmount: '3000' });
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toContain(1);
    expect(result.map(t => t.id)).toContain(2);
  });

  it('should filter by search term', () => {
    const result = filterTransactions(mockTransactions, { ...defaultCriteria, searchTerm: 'Lunch' });
    expect(result).toHaveLength(1);
    expect(result[0]!.description).toBe('Lunch');
  });

  it('should search by category name when categoryMap is provided', () => {
    const categoryMap = {
      1: { id: 1, name: 'Food', icon: '🍔', color: '#ff0000' },
      2: { id: 2, name: 'Groceries', icon: '🛒', color: '#00ff00' },
    };
    // Search for 'Food' — should match transaction with categoryId: 1 (first transaction)
    const result = filterTransactions(mockTransactions, {
      ...defaultCriteria,
      searchTerm: 'Food',
      categoryMap,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
  });

  it('should search by wallet name when walletMap is provided', () => {
    const walletMap = {
      1: { id: 1, name: 'Cash', currency: 'IDR', initialBalance: 0, lastUpdated: '2024-01-01' },
      2: { id: 2, name: 'Bank Account', currency: 'IDR', initialBalance: 1000, lastUpdated: '2024-01-01' },
    };
    // Search for 'Bank' — should match transaction with walletId: 2 (third transaction)
    const result = filterTransactions(mockTransactions, {
      ...defaultCriteria,
      searchTerm: 'Bank',
      walletMap,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(3);
  });

  it('should filter by date range', () => {
    const result = filterTransactions(mockTransactions, { 
      ...defaultCriteria, 
      startDate: '2023-10-02', 
      endDate: '2023-10-03' 
    });
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id!)).toContain(2);
    expect(result.map(t => t.id!)).toContain(3);
  });
});
