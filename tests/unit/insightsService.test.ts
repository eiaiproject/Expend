import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import { generateInsights, dismissInsight, getDismissedInsightIds, type InsightContext } from '@/services/insightsService';
import type { Transaction, Category, Wallet, Debt, Schedule } from '@/db/db';

// Deterministic "today" so month-boundary logic is stable in tests.
const NOW = new Date('2026-07-15T10:00:00Z');
const TODAY = '2026-07-15';
const CUR_MONTH = '2026-07';
const PREV_MONTH = '2026-06';

let txId = 0;

function makeTx(overrides: Partial<Transaction>): Transaction {
  txId += 1;
  return {
    id: txId,
    walletId: 1,
    categoryId: null,
    date: TODAY,
    description: '',
    type: 'expense',
    amount: 0,
    ...overrides,
  };
}

function makeWallet(id: number, overrides: Partial<Wallet> = {}): Wallet {
  return { id, name: `Wallet ${id}`, color: '#000000', initialBalance: 0, currentBalance: 0, lastUpdated: new Date().toISOString(), ...overrides } as Wallet;
}

function makeCategory(id: number, overrides: Partial<Category> = {}): Category {
  return { id, name: `Cat ${id}`, icon: '', color: '#000000', ...overrides } as Category;
}

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: `debt_${txId++}`,
    type: 'payable',
    personName: 'Alice',
    principalAmount: 100000,
    remainingAmount: 100000,
    walletId: 1,
    startDate: '2026-01-01',
    ...overrides,
  } as Debt;
}

function makeSchedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: `sched_${txId++}`,
    type: 'expense',
    frequency: 'monthly',
    startDate: '2026-01-01',
    nextOccurrence: TODAY,
    amount: 100000,
    categoryId: null,
    walletId: 1,
    payee: 'Rent',
    mode: 'remind',
    active: true,
    lastProcessedOccurrence: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Schedule;
}

function ctx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    transactions: [],
    categories: [],
    wallets: [makeWallet(1)],
    debts: [],
    schedules: [],
    dismissedIds: new Set<string>(),
    now: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  txId = 0;
});

describe('generateInsights (master.md 10)', () => {
  it('returns no insights for empty data', () => {
    expect(generateInsights(ctx({ wallets: [] }))).toEqual([]);
  });

  it('does not flag a brand-new wallet with no transactions as stale', () => {
    const insights = generateInsights(ctx({
      wallets: [makeWallet(1, { lastUpdated: '2026-07-14T10:00:00Z' })],
    }));
    expect(insights.find((i) => i.kind === 'staleWallet')).toBeUndefined();
  });

  it('categoryIncrease: flags a category with a 50%+ increase and enough samples', () => {
    const transactions = [
      makeTx({ date: `${CUR_MONTH}-01`, categoryId: 1, amount: 10000 }),
      makeTx({ date: `${CUR_MONTH}-02`, categoryId: 1, amount: 10000 }),
      makeTx({ date: `${CUR_MONTH}-03`, categoryId: 1, amount: 10000 }),
      makeTx({ date: `${PREV_MONTH}-01`, categoryId: 1, amount: 20000 }),
    ];
    const insights = generateInsights(ctx({ transactions, categories: [makeCategory(1)] }));
    const insight = insights.find((i) => i.kind === 'categoryIncrease');
    expect(insight).toBeDefined();
    expect(insight?.params.percent).toBe(50);
    expect(insight?.target).toBe('/stats');
  });

  it('categoryIncrease: stays silent when the current month is too sparse', () => {
    const transactions = [
      makeTx({ date: `${CUR_MONTH}-01`, categoryId: 1, amount: 10000 }), // only 2 samples
      makeTx({ date: `${CUR_MONTH}-02`, categoryId: 1, amount: 10000 }),
      makeTx({ date: `${PREV_MONTH}-01`, categoryId: 1, amount: 5000 }),
    ];
    expect(generateInsights(ctx({ transactions, categories: [makeCategory(1)] }))).toEqual([]);
  });

  it('monthOverMonth: flags a 25%+ month increase with enough samples', () => {
    const transactions = [
      ...[1, 2, 3, 4, 5].map((d) => makeTx({ date: `${CUR_MONTH}-0${d}`, amount: 10400 })),
      ...[1, 2, 3, 4].map((d) => makeTx({ date: `${PREV_MONTH}-0${d}`, amount: 10000 })),
    ];
    const insights = generateInsights(ctx({ transactions }));
    const insight = insights.find((i) => i.kind === 'monthOverMonth');
    expect(insight).toBeDefined();
    expect(insight?.params.percent).toBe(30);
  });

  it('topPayee: picks the highest-spending payee in the last 90 days with >= 3 transactions', () => {
    const transactions = [
      makeTx({ date: `${CUR_MONTH}-01`, description: 'Kopi', amount: 5000 }),
      makeTx({ date: `${CUR_MONTH}-02`, description: 'kopi', amount: 5000 }),
      makeTx({ date: `${CUR_MONTH}-03`, description: 'KOPI', amount: 5000 }),
      makeTx({ date: `${CUR_MONTH}-01`, description: 'Nasi Goreng', amount: 40000 }),
      makeTx({ date: '2026-01-01', description: 'Kopi', amount: 9000 }), // outside 90 days
    ];
    const insights = generateInsights(ctx({ transactions }));
    const insight = insights.find((i) => i.kind === 'topPayee');
    expect(insight).toBeDefined();
    expect(insight?.target).toContain('/payees?q=');
  });

  it('budgetExhaustion: projects over-budget spend but skips already-over categories', () => {
    const dayOfMonth = 15;
    const transactions = [
      ...[1, 2, 3, 4, 5, 6].map((d) => makeTx({ date: `${CUR_MONTH}-0${d}`, categoryId: 1, amount: 10000 })), // 60k by day 6
      makeTx({ date: `${CUR_MONTH}-01`, categoryId: 2, amount: 200000 }), // already over 100k budget
    ];
    const categories = [makeCategory(1, { budget: 100000 }), makeCategory(2, { budget: 100000 })];
    const insights = generateInsights(ctx({ transactions, categories }));
    const insight = insights.find((i) => i.kind === 'budgetExhaustion');
    expect(insight).toBeDefined();
    expect(insight?.params.category).toBe('Cat 1');
    expect(insight?.target).toBe('/categories');
  });

  it('staleWallet: flags a wallet with no activity in 60 days', () => {
    const transactions = [makeTx({ date: '2026-01-01', walletId: 2, amount: 5000 })];
    const wallets = [makeWallet(1), makeWallet(2)];
    const insights = generateInsights(ctx({ transactions, wallets }));
    const insight = insights.find((i) => i.kind === 'staleWallet');
    expect(insight).toBeDefined();
    expect(insight?.params.wallet).toBe('Wallet 2');
    expect(insight?.target).toBe('/wallets/2');
  });

  it('debtDue: flags overdue debts and debts due within a week', () => {
    const overdue = generateInsights(ctx({
      debts: [makeDebt({ dueDate: '2026-07-10' })],
    }));
    expect(overdue.find((i) => i.kind === 'debtDue')?.titleKey).toBe('insight.debtOverdue');

    const upcoming = generateInsights(ctx({
      debts: [makeDebt({ dueDate: '2026-07-18' })],
    }));
    expect(upcoming.find((i) => i.kind === 'debtDue')?.titleKey).toBe('insight.debtDueIn');

    // Paid debts are ignored.
    const paid = generateInsights(ctx({
      debts: [makeDebt({ dueDate: '2026-07-10', status: 'paid' })],
    }));
    expect(paid.find((i) => i.kind === 'debtDue')).toBeUndefined();
  });

  it('recurringIncrease: flags a schedule 25% above its usual amount', () => {
    const transactions = [
      makeTx({ date: '2026-05-01', description: 'Rent', amount: 100000 }),
      makeTx({ date: '2026-06-01', description: 'Rent', amount: 100000 }),
    ];
    const schedules = [makeSchedule({ amount: 150000 })];
    const insights = generateInsights(ctx({ transactions, schedules }));
    const insight = insights.find((i) => i.kind === 'recurringIncrease');
    expect(insight).toBeDefined();
    expect(insight?.params.percent).toBe(50);
    expect(insight?.target).toBe('/schedules');
  });

  it('skips dismissed insights and orders the rest by priority', () => {
    const transactions = [
      ...[1, 2, 3, 4, 5].map((d) => makeTx({ date: `${CUR_MONTH}-0${d}`, amount: 10400 })),
      ...[1, 2, 3, 4].map((d) => makeTx({ date: `${PREV_MONTH}-0${d}`, amount: 10000 })),
      ...[1, 2, 3].map((d) => makeTx({ date: `${CUR_MONTH}-0${d}`, categoryId: 2, amount: 20000 })),
      makeTx({ date: `${PREV_MONTH}-01`, categoryId: 2, amount: 10000 }),
    ];
    const dismissed = new Set<string>();
    const all = generateInsights(ctx({ transactions, categories: [makeCategory(2)], dismissedIds: dismissed }));
    expect(all.length).toBeGreaterThan(1);
    const priorities = all.map((i) => i.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));

    const dismissedAgain = generateInsights(ctx({ transactions, dismissedIds: new Set([all[0].id]) }));
    expect(dismissedAgain.some((i) => i.id === all[0].id)).toBe(false);
  });
});

describe('dismissInsight / getDismissedInsightIds', () => {
  it('persists dismissed ids in the settings store', async () => {
    const walletId = (await db.wallets.add(makeWallet(99))).toString();
    void walletId;
    await dismissInsight('debtDue:debt_1');
    const ids = await getDismissedInsightIds();
    expect(ids.has('debtDue:debt_1')).toBe(true);
    expect(ids.has('monthOverMonth:current')).toBe(false);
  });
});
