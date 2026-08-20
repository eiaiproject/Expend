import { describe, it, expect } from 'vitest';
import { findRecentDuplicate } from '../../src/services/duplicateDetectionService';
import type { Transaction } from '../../src/db/db';

const base: Transaction = {
  id: 1, type: 'expense', amount: 25000, description: 'Nasi Padang',
  date: '2026-08-20T08:00:00', walletId: 1, categoryId: 1,
};

describe('findRecentDuplicate', () => {
  it('matches same payee + amount within window', () => {
    const dup = { ...base, description: 'nasi padang ' };
    expect(findRecentDuplicate([dup], { amount: 25000, description: 'Nasi Padang', date: '2026-08-20T08:05:00' })).not.toBeNull();
  });
  it('ignores different amount', () => {
    const other = { ...base, amount: 15000 };
    expect(findRecentDuplicate([other], { amount: 25000, description: 'Nasi Padang', date: '2026-08-20T08:05:00' })).toBeNull();
  });
  it('ignores transactions outside the window', () => {
    const old = { ...base, date: '2026-08-19T08:00:00' };
    expect(findRecentDuplicate([old], { amount: 25000, description: 'Nasi Padang', date: '2026-08-20T08:05:00' })).toBeNull();
  });
  it('ignores non-expense transactions', () => {
    const transfer = { ...base, type: 'transfer_out' as const };
    expect(findRecentDuplicate([transfer], { amount: 25000, description: 'Nasi Padang', date: '2026-08-20T08:05:00' })).toBeNull();
  });
  it('ignores itself when an excludeId is given (edit flow)', () => {
    const self = { ...base, id: 7 };
    expect(findRecentDuplicate([self], { amount: 25000, description: 'Nasi Padang', date: '2026-08-20T08:05:00' }, 30, 7)).toBeNull();
  });
});