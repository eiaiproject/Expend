import { describe, it, expect } from 'vitest';
import { computeDailySpending, computeBudgetStatuses, generateInsight, computeTotalExpense } from './budgetService';
import { Transaction, Category } from '../db/db';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    walletId: 1,
    categoryId: 1,
    date: '2024-01-15',
    description: 'Test',
    type: 'expense',
    amount: 1000,
    ...overrides,
  };
}

function makeCat(overrides: Partial<Category>): Category {
  return {
    id: 1,
    name: 'Food',
    icon: '🍔',
    color: '#ff0000',
    ...overrides,
  };
}

describe('computeDailySpending', () => {
  it('returns zero for empty transactions', () => {
    const result = computeDailySpending([]);
    expect(result.today).toBe(0);
    expect(result.yesterday).toBe(0);
  });

  it('counts only expense type transactions', () => {
    const tx = makeTx({ type: 'balance_adjustment', amount: 5000 });
    const result = computeDailySpending([tx]);
    expect(result.today).toBe(0);
  });
});

describe('computeBudgetStatuses', () => {
  it('returns empty array when no categories have budgets', () => {
    const cats = [makeCat({ budget: undefined })];
    expect(computeBudgetStatuses([], cats)).toEqual([]);
  });

  it('returns correct budget status for a category', () => {
    const cat = makeCat({ id: 1, budget: 1000 });
    // Use a date inside current month so budget computation picks it up
    const now = new Date();
    const day = String(now.getUTCDate()).padStart(2, '0');
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const year = now.getUTCFullYear();
    const todayStr = `${year}-${month}-${day}`;

    const tx = makeTx({ categoryId: 1, amount: 600, date: todayStr });
    const statuses = computeBudgetStatuses([tx], [cat]);

    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.spent).toBe(600);
    expect(statuses[0]!.remaining).toBe(400);
    expect(statuses[0]!.percentage).toBe(60);
    expect(statuses[0]!.isOverBudget).toBe(false);
    expect(statuses[0]!.isNearLimit).toBe(false);
  });

  it('flags over-budget categories correctly', () => {
    const cat = makeCat({ id: 1, budget: 500 });
    const now = new Date();
    const day = String(now.getUTCDate()).padStart(2, '0');
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const year = now.getUTCFullYear();
    const todayStr = `${year}-${month}-${day}`;

    const tx1 = makeTx({ categoryId: 1, amount: 400, date: todayStr });
    const tx2 = makeTx({ id: 2, categoryId: 1, amount: 200, date: todayStr });

    const statuses = computeBudgetStatuses([tx1, tx2], [cat]);
    expect(statuses[0]!.isOverBudget).toBe(true);
    expect(statuses[0]!.spent).toBe(600);
  });
});

describe('generateInsight', () => {
  const mockT = (key: string) => {
    const map: Record<string, string> = {
      'Budget alert': 'Budget alert',
      'exceeded budget': 'exceeded budget',
      'near budget limit': 'near budget limit',
      'Spending up': 'Spending up',
      'Spending down': 'Spending down',
      'is your top spending category this month': 'is your top spending category this month',
    };
    return map[key] || key;
  };

  it('returns null when no notable insight is found', () => {
    expect(generateInsight([], [], mockT)).toBeNull();
  });
});

describe('computeTotalExpense', () => {
  it('sums only expense transactions', () => {
    const txs = [
      makeTx({ amount: 1000 }),
      makeTx({ id: 2, type: 'balance_adjustment', amount: 5000 }),
      makeTx({ id: 3, amount: 2000 }),
    ];
    expect(computeTotalExpense(txs)).toBe(3000);
  });
});
