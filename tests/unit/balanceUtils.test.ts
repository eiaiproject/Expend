import { describe, it, expect } from 'vitest';
import { getBalanceDelta, recomputeWalletCurrentBalances } from '@/utils/balanceUtils';
import type { Transaction, Wallet } from '@/db/db';

describe('balanceUtils', () => {
  describe('getBalanceDelta', () => {
    it('returns negative for expense', () => {
      const delta = getBalanceDelta('expense', 100000);
      expect(delta).toBe(-100000);
    });

    it('returns positive for transfer_in', () => {
      const delta = getBalanceDelta('transfer_in', 500000);
      expect(delta).toBe(500000);
    });

    it('returns negative for transfer_out', () => {
      const delta = getBalanceDelta('transfer_out', 200000);
      expect(delta).toBe(-200000);
    });

    it('returns positive for balance_adjustment', () => {
      const delta = getBalanceDelta('balance_adjustment', 50000);
      expect(delta).toBe(50000);
    });
  });

  describe('recomputeWalletCurrentBalances', () => {
    it('computes balances from transactions', () => {
      const wallets: Wallet[] = [
        { id: 1, name: 'Cash', currency: 'IDR', lastUpdated: '2024-01-15', initialBalance: 1000000 },
      ];
      const transactions: Transaction[] = [
        { id: 1, walletId: 1, categoryId: 1, date: '2024-01-15', description: 'Expense', type: 'expense', amount: 100000 },
        { id: 2, walletId: 1, categoryId: 1, date: '2024-01-15', description: 'Transfer In', type: 'transfer_in', amount: 500000 },
      ];

      const result = recomputeWalletCurrentBalances(wallets, transactions);
      expect(result[0].currentBalance).toBe(1000000 - 100000 + 500000);
    });

    it('returns initial balance when no transactions', () => {
      const wallets: Wallet[] = [
        { id: 1, name: 'Cash', currency: 'IDR', lastUpdated: '2024-01-15', initialBalance: 500000 },
      ];

      const result = recomputeWalletCurrentBalances(wallets, []);
      expect(result[0].currentBalance).toBe(500000);
    });

    it('handles multiple wallets', () => {
      const wallets: Wallet[] = [
        { id: 1, name: 'Cash', currency: 'IDR', lastUpdated: '2024-01-15', initialBalance: 1000000 },
        { id: 2, name: 'Bank', currency: 'IDR', lastUpdated: '2024-01-15', initialBalance: 5000000 },
      ];
      const transactions: Transaction[] = [
        { id: 1, walletId: 1, categoryId: 1, date: '2024-01-15', description: 'Expense', type: 'expense', amount: 100000 },
        { id: 2, walletId: 2, categoryId: 1, date: '2024-01-15', description: 'Transfer In', type: 'transfer_in', amount: 500000 },
      ];

      const result = recomputeWalletCurrentBalances(wallets, transactions);
      expect(result[0].currentBalance).toBe(1000000 - 100000);
      expect(result[1].currentBalance).toBe(5000000 + 500000);
    });
  });
});
