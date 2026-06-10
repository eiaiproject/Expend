import { describe, expect, it } from 'vitest';
import type { Debt, DebtPayment } from '../db/db';
import { buildDebtPaymentsMap, calculateDebtStatus, summarizeDebts } from './debtService';

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: 'debt_1',
    type: 'payable',
    personName: 'Andi',
    principalAmount: 1_000_000,
    remainingAmount: 1_000_000,
    walletId: 1,
    startDate: '2026-06-01',
    dueDate: null,
    status: 'open',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    archivedAt: null,
    ...overrides,
  };
}

function makePayment(overrides: Partial<DebtPayment>): DebtPayment {
  return {
    id: 'payment_1',
    debtId: 'debt_1',
    amount: 300_000,
    date: '2026-06-05',
    walletId: 1,
    type: 'repayment',
    linkedTransactionId: null,
    createdAt: '2026-06-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('calculateDebtStatus', () => {
  it('marks remaining zero as paid', () => {
    const debt = makeDebt({ remainingAmount: 0 });
    expect(calculateDebtStatus(debt, [], '2026-06-10')).toBe('paid');
  });

  it('marks due date before today as overdue', () => {
    const debt = makeDebt({ dueDate: '2026-06-09', remainingAmount: 500_000 });
    expect(calculateDebtStatus(debt, [], '2026-06-10')).toBe('overdue');
  });

  it('does not mark no due date as overdue', () => {
    const debt = makeDebt({ dueDate: null, remainingAmount: 1_000_000 });
    expect(calculateDebtStatus(debt, [], '2026-06-10')).toBe('open');
  });

  it('marks repayment as partial when remaining is still positive', () => {
    const debt = makeDebt({ remainingAmount: 700_000 });
    expect(calculateDebtStatus(debt, [makePayment({})], '2026-06-10')).toBe('partial');
  });

  it('preserves written off status', () => {
    const debt = makeDebt({ status: 'written_off', remainingAmount: 0 });
    expect(calculateDebtStatus(debt, [], '2026-06-10')).toBe('written_off');
  });
});

describe('summarizeDebts', () => {
  it('summarizes payable, receivable, net position, and attention counts', () => {
    const debts = [
      makeDebt({ id: 'payable_1', type: 'payable', remainingAmount: 700_000, dueDate: '2026-06-09' }),
      makeDebt({ id: 'receivable_1', type: 'receivable', remainingAmount: 1_000_000, dueDate: '2026-06-12' }),
      makeDebt({ id: 'paid_1', type: 'payable', remainingAmount: 0, dueDate: '2026-06-01' }),
    ];

    const summary = summarizeDebts(debts, {}, '2026-06-10');

    expect(summary.payableTotal).toBe(700_000);
    expect(summary.receivableTotal).toBe(1_000_000);
    expect(summary.netPosition).toBe(300_000);
    expect(summary.overdueCount).toBe(1);
    expect(summary.dueSoonCount).toBe(1);
    expect(summary.attentionCount).toBe(2);
    expect(summary.activeCount).toBe(2);
    expect(summary.paidCount).toBe(1);
  });

  it('ignores archived debts', () => {
    const summary = summarizeDebts([
      makeDebt({ archivedAt: '2026-06-10T00:00:00.000Z', remainingAmount: 500_000 }),
    ], {}, '2026-06-10');

    expect(summary.activeCount).toBe(0);
    expect(summary.payableTotal).toBe(0);
  });

  it('groups payments by debt id', () => {
    const map = buildDebtPaymentsMap([
      makePayment({ id: 'p1', debtId: 'd1' }),
      makePayment({ id: 'p2', debtId: 'd1' }),
      makePayment({ id: 'p3', debtId: 'd2' }),
    ]);

    expect(map.d1).toHaveLength(2);
    expect(map.d2).toHaveLength(1);
  });
});
