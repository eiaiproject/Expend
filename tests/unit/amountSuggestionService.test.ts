import { describe, it, expect } from 'vitest';
import { suggestAmountsForPayee } from '../../src/services/amountSuggestionService';
import type { Transaction } from '../../src/db/db';

const tx = (description: string, amount: number, id: number): Transaction =>
  ({ id, type: 'expense', amount, description, date: '2026-08-01', walletId: 1, categoryId: 1 });

describe('suggestAmountsForPayee', () => {
  it('returns most frequent amounts for the payee, most frequent first', () => {
    const txs = [
      tx('Gojek', 15000, 1), tx('gojek', 15000, 2), tx('Gojek', 15000, 3),
      tx('Gojek', 25000, 4), tx('gojek', 25000, 5),
    ];
    expect(suggestAmountsForPayee(txs, 'Gojek', [], 3)).toEqual([15000, 25000]);
  });
  it('falls back when payee has no history', () => {
    expect(suggestAmountsForPayee([], 'Starbucks', [10000, 50000])).toEqual([10000, 50000]);
  });
  it('falls back on empty payee', () => {
    expect(suggestAmountsForPayee([tx('Gojek', 15000, 1)], '', [10000])).toEqual([10000]);
  });
});