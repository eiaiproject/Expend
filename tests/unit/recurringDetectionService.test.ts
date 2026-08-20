import { describe, it, expect } from 'vitest';
import { detectRecurringCandidates } from '../../src/services/recurringDetectionService';
import type { Transaction } from '../../src/db/db';

function tx(id: number, description: string, amount: number, date: string): Transaction {
  return {
    id,
    type: 'expense',
    description,
    amount,
    date,
    walletId: 1,
    categoryId: 1,
    notes: '',
    createdAt: '',
    updatedAt: '',
  } as Transaction;
}

describe('detectRecurringCandidates', () => {
  it('detects a weekly payee with 4 occurrences', () => {
    const txs = [
      tx(1, 'Rent Kos', 1000000, '2026-08-03T08:00'),
      tx(2, 'Rent Kos', 1000000, '2026-08-10T08:00'),
      tx(3, 'Rent Kos', 1000000, '2026-08-17T08:00'),
      tx(4, 'Rent Kos', 1000000, '2026-08-24T08:00'),
    ];
    const result = detectRecurringCandidates(txs, '2026-08-25');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      payeeName: 'Rent Kos',
      amount: 1000000,
      intervalDays: 7,
      nextDate: '2026-08-31',
      occurrenceCount: 4,
    });
  });

  it('ignores payees with fewer than 3 occurrences', () => {
    const txs = [tx(1, 'Kopi', 15000, '2026-08-03T08:00'), tx(2, 'Kopi', 15000, '2026-08-10T08:00')];
    expect(detectRecurringCandidates(txs, '2026-08-25')).toHaveLength(0);
  });

  it('ignores payees whose amounts vary', () => {
    const txs = [
      tx(1, 'Gojek', 20000, '2026-08-03T08:00'),
      tx(2, 'Gojek', 25000, '2026-08-10T08:00'),
      tx(3, 'Gojek', 18000, '2026-08-17T08:00'),
    ];
    expect(detectRecurringCandidates(txs, '2026-08-25')).toHaveLength(0);
  });

  it('does not suggest when a schedule already exists for the payee', () => {
    const txs = [
      tx(1, 'BPJS', 50000, '2026-08-01T08:00'),
      tx(2, 'BPJS', 50000, '2026-08-08T08:00'),
      tx(3, 'BPJS', 50000, '2026-08-15T08:00'),
    ];
    const existing = ['bpjs'];
    expect(detectRecurringCandidates(txs, '2026-08-22', existing)).toHaveLength(0);
  });
});