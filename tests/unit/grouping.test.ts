import { describe, it, expect } from 'vitest';
import { groupTransactions, type GroupGranularity } from '../../src/utils/grouping';
import type { Transaction } from '../../src/db/db';

function tx(description: string, amount: number, date: string): Transaction {
  return { description, amount, date, createdAt: `${date}T10:00:00.000Z` };
}

describe('groupTransactions', () => {
  it('groups by day desc with subtotals', () => {
    const txs = [tx('B', 20000, '2026-09-15'), tx('A', 50000, '2026-09-14'), tx('C', 10000, '2026-09-14')];
    const groups = groupTransactions(txs, 'day');
    expect(groups).toHaveLength(2);
    expect(groups[0]!.key).toBe('2026-09-15');
    expect(groups[0]!.total).toBe(20000);
    expect(groups[1]!.key).toBe('2026-09-14');
    expect(groups[1]!.total).toBe(60000);
    expect(groups[1]!.count).toBe(2);
  });

  it('groups by week starting Monday', () => {
    const txs = [
      tx('Senin', 10000, '2026-09-14'),
      tx('Minggu', 20000, '2026-09-20'),
      tx('Senin depan', 30000, '2026-09-21'),
    ];
    const groups = groupTransactions(txs, 'week');
    expect(groups).toHaveLength(2);
    // desc: week of 21 first, then week of 14 (contains 14+20)
    expect(groups[0]!.key).toBe('2026-09-21');
    expect(groups[0]!.total).toBe(30000);
    expect(groups[1]!.key).toBe('2026-09-14');
    expect(groups[1]!.total).toBe(30000);
    expect(groups[1]!.count).toBe(2);
  });

  it('groups by month desc', () => {
    const txs = [tx('Sep', 5000, '2026-09-01'), tx('Agu', 7000, '2026-08-31'), tx('Sep2', 3000, '2026-09-20')];
    const groups = groupTransactions(txs, 'month');
    expect(groups).toHaveLength(2);
    expect(groups[0]!.key).toBe('2026-09');
    expect(groups[0]!.total).toBe(8000);
    expect(groups[1]!.key).toBe('2026-08');
  });

  it('empty returns empty', () => {
    const g: ReturnType<typeof groupTransactions> = groupTransactions([], 'day' satisfies GroupGranularity);
    expect(g).toEqual([]);
  });
});
