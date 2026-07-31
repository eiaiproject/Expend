import { db, type Transaction, type Category, type Wallet, type Debt, type Schedule } from '../db/db';
import { getTodayStr } from '../utils/dateUtils';
import { normalizePayeeKey } from './payeeService';

export type InsightKind =
  | 'categoryIncrease'
  | 'monthOverMonth'
  | 'topPayee'
  | 'budgetExhaustion'
  | 'staleWallet'
  | 'debtDue'
  | 'recurringIncrease';

export interface Insight {
  /** Stable id for dismissal: `${kind}:${key}` */
  id: string;
  kind: InsightKind;
  /** Lower = higher priority. Home shows at most three by priority. */
  priority: number;
  titleKey: string;
  params: Record<string, string | number>;
  /** Drill-down route (master.md 10: every insight is verifiable). */
  target: string;
}

export interface InsightContext {
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  debts: Debt[];
  schedules: Schedule[];
  dismissedIds: ReadonlySet<string>;
  now?: Date;
}

const DISMISSED_INSIGHTS_KEY = 'dismissedInsights';

// ── Period helpers (date-string arithmetic, TZ-safe) ─────────────────────

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function isInMonth(dateStr: string, key: string): boolean {
  return monthKey(dateStr) === key;
}

function prevMonthKey(key: string): string {
  const [y = 0, m = 1] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function daysInMonth(key: string): number {
  const [y = 0, m = 1] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Calendar days from `from` to `to` (negative when `to` is in the past). */
function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** Add days to a YYYY-MM-DD string (TZ-safe string arithmetic). */
function addDays(dateStr: string, days: number): string {
  const [y = 0, m = 1, d = 1] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, (d ?? 1) + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

// ── Individual insight builders ───────────────────────────────────────────

interface CategoryPeriodTotals {
  cur: number;
  curCount: number;
  prev: number;
  prevCount: number;
}

/** Aggregate expense totals by category for the current and previous month keys. */
function aggregateCategoryPeriods(
  expenses: Transaction[],
  curKey: string,
  prevKey: string,
): Map<number, CategoryPeriodTotals> {
  const byCategory = new Map<number, CategoryPeriodTotals>();
  for (const t of expenses) {
    if (!t.categoryId) continue;
    const entry = byCategory.get(t.categoryId) ?? { cur: 0, curCount: 0, prev: 0, prevCount: 0 };
    if (isInMonth(t.date, curKey)) { entry.cur += t.amount; entry.curCount += 1; }
    else if (isInMonth(t.date, prevKey)) { entry.prev += t.amount; entry.prevCount += 1; }
    byCategory.set(t.categoryId, entry);
  }
  return byCategory;
}

/**
 * Find the category with the strongest meaningful increase between the two
 * periods. Guardrails: enough current samples, a comparable previous period,
 * and a meaningful increase (>= 50%). Sparse data never claims a trend.
 */
function findTopCategoryIncrease(
  byCategory: Map<number, CategoryPeriodTotals>,
  categories: readonly Category[],
): { cat: Category; pct: number } | null {
  let best: { cat: Category; pct: number } | null = null;
  for (const [catId, v] of byCategory) {
    if (v.curCount < 3 || v.prevCount < 1 || v.prev <= 0) continue;
    const pct = Math.round(((v.cur - v.prev) / v.prev) * 100);
    if (pct < 50) continue;
    const cat = categories.find((c) => c.id === catId);
    if (!cat || cat.archivedAt) continue;
    if (!best || pct > best.pct) best = { cat, pct };
  }
  return best;
}

function buildCategoryIncrease(ctx: InsightContext): Insight | null {
  const today = getTodayStr(ctx.now);
  const curKey = monthKey(today);
  const prevKey = prevMonthKey(curKey);

  const expenses = ctx.transactions.filter((t) => t.type === 'expense' && t.categoryId != null);
  const byCategory = aggregateCategoryPeriods(expenses, curKey, prevKey);
  const best = findTopCategoryIncrease(byCategory, ctx.categories);
  if (!best) return null;

  return {
    id: `categoryIncrease:${best.cat.id}`,
    kind: 'categoryIncrease',
    priority: 3,
    titleKey: 'insight.categoryIncrease',
    params: { category: best.cat.name, percent: best.pct },
    target: '/stats',
  };
}

function buildMonthOverMonth(ctx: InsightContext): Insight | null {
  const today = getTodayStr(ctx.now);
  const curKey = monthKey(today);
  const prevKey = prevMonthKey(curKey);

  const expenses = ctx.transactions.filter((t) => t.type === 'expense');
  let cur = 0; let curCount = 0; let prev = 0; let prevCount = 0;
  for (const t of expenses) {
    if (isInMonth(t.date, curKey)) { cur += t.amount; curCount += 1; }
    else if (isInMonth(t.date, prevKey)) { prev += t.amount; prevCount += 1; }
  }
  if (curCount < 5 || prevCount < 3 || prev <= 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct < 25) return null;

  return {
    id: 'monthOverMonth:current',
    kind: 'monthOverMonth',
    priority: 4,
    titleKey: 'insight.monthOverMonth',
    params: { percent: pct },
    target: '/stats',
  };
}

function buildTopPayee(ctx: InsightContext): Insight | null {
  const cutoff = addDays(getTodayStr(ctx.now), -90);
  const expenses = ctx.transactions.filter(
    (t) => t.type === 'expense' && t.description.trim() !== '' && t.date >= cutoff,
  );
  const byPayee = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const key = normalizePayeeKey(t.description);
    const entry = byPayee.get(key) ?? { total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    byPayee.set(key, entry);
  }
  let bestKey = '';
  let best = { total: 0, count: 0 };
  for (const [key, v] of byPayee) {
    if (v.count >= 3 && v.total > best.total) { best = v; bestKey = key; }
  }
  if (!bestKey) return null;
  const displayName = expenses.find((t) => normalizePayeeKey(t.description) === bestKey)?.description ?? bestKey;

  return {
    id: `topPayee:${bestKey}`,
    kind: 'topPayee',
    priority: 5,
    titleKey: 'insight.topPayee',
    params: { payee: displayName, count: best.count },
    target: `/payees?q=${encodeURIComponent(displayName)}`,
  };
}

function buildBudgetExhaustion(ctx: InsightContext): Insight | null {
  const today = getTodayStr(ctx.now);
  const curKey = monthKey(today);
  const dayOfMonth = Number(today.slice(8, 10));
  const dim = daysInMonth(curKey);
  if (dayOfMonth >= dim) return null; // month over — nothing to project

  const expenses = ctx.transactions.filter((t) => t.type === 'expense' && t.categoryId != null && isInMonth(t.date, curKey));
  const spentByCategory = new Map<number, number>();
  for (const t of expenses) {
    if (!t.categoryId) continue;
    spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
  }

  for (const cat of ctx.categories) {
    if (!cat.budget || cat.budget <= 0 || cat.archivedAt) continue;
    const spent = spentByCategory.get(cat.id!) ?? 0;
    if (spent <= 0) continue;
    const projected = (spent / dayOfMonth) * dim;
    // Only when not yet over (the SummaryCard alert already covers that) and
    // when the projection is meaningful (>= 15% headroom consumed).
    if (spent < cat.budget && projected >= cat.budget && spent >= cat.budget * 0.4) {
      return {
        id: `budgetExhaustion:${cat.id}`,
        kind: 'budgetExhaustion',
        priority: 2,
        titleKey: 'insight.budgetExhaustion',
        params: { category: cat.name },
        target: '/categories',
      };
    }
  }
  return null;
}

function buildStaleWallet(ctx: InsightContext): Insight | null {
  const today = getTodayStr(ctx.now);
  const cutoff = addDays(today, -60);
  for (const wallet of ctx.wallets) {
    if (wallet.archivedAt) continue;
    const hasRecent = ctx.transactions.some((t) => t.walletId === wallet.id && t.date > cutoff);
    if (hasRecent) continue;
    // Brand-new wallets (no history, just created) are not "stale" yet.
    const hasAny = ctx.transactions.some((t) => t.walletId === wallet.id);
    if (!hasAny && wallet.lastUpdated.slice(0, 10) >= cutoff) continue;
    const days = daysBetween(
      ctx.transactions
        .filter((t) => t.walletId === wallet.id)
        .map((t) => t.date)
        .sort((a, b) => a.localeCompare(b))
        .pop() ?? wallet.lastUpdated.slice(0, 10),
      today,
    );
    return {
      id: `staleWallet:${wallet.id}`,
      kind: 'staleWallet',
      priority: 6,
      titleKey: 'insight.staleWallet',
      params: { wallet: wallet.name, days: Math.max(days, 60) },
      target: `/wallets/${wallet.id}`,
    };
  }
  return null;
}

function buildDebtDue(ctx: InsightContext): Insight | null {
  const today = getTodayStr(ctx.now);
  const closed = new Set(['paid', 'written_off', 'archived']);
  for (const debt of ctx.debts) {
    if (!debt.dueDate || debt.archivedAt || (debt.status && closed.has(debt.status))) continue;
    const days = daysBetween(today, debt.dueDate);
    if (days < -60 || days > 7) continue; // only overdue (recent) or due within a week
    if (days < 0) {
      return {
        id: `debtDue:${debt.id}`,
        kind: 'debtDue',
        priority: 1,
        titleKey: 'insight.debtOverdue',
        params: { person: debt.personName, days: Math.abs(days) },
        target: '/debts',
      };
    }
    return {
      id: `debtDue:${debt.id}`,
      kind: 'debtDue',
      priority: 1,
      titleKey: 'insight.debtDueIn',
      params: { person: debt.personName, days },
      target: '/debts',
    };
  }
  return null;
}

function buildRecurringIncrease(ctx: InsightContext): Insight | null {
  const cutoff = addDays(getTodayStr(ctx.now), -180);
  const expenses = ctx.transactions.filter((t) => t.type === 'expense' && t.date >= cutoff);
  for (const schedule of ctx.schedules) {
    if (!schedule.active || !schedule.payee?.trim()) continue;
    const key = normalizePayeeKey(schedule.payee);
    const matches = expenses.filter((t) => normalizePayeeKey(t.description) === key);
    if (matches.length < 2) continue;
    const avg = matches.reduce((sum, t) => sum + t.amount, 0) / matches.length;
    if (avg <= 0) continue;
    const pct = Math.round(((schedule.amount - avg) / avg) * 100);
    if (pct < 25) continue;
    return {
      id: `recurringIncrease:${schedule.id}`,
      kind: 'recurringIncrease',
      priority: 7,
      titleKey: 'insight.recurringIncrease',
      params: { payee: schedule.payee, percent: pct },
      target: '/schedules',
    };
  }
  return null;
}

// ── Entry point ───────────────────────────────────────────────────────────

/**
 * Generate actionable insights (master.md 10). Deterministic, guard-railed:
 * sparse data never produces a claim, comparisons use equivalent periods,
 * projections are labeled as estimates, and dismissed insights are skipped.
 */
export function generateInsights(ctx: InsightContext): Insight[] {
  const builders = [
    buildDebtDue,
    buildBudgetExhaustion,
    buildCategoryIncrease,
    buildMonthOverMonth,
    buildTopPayee,
    buildStaleWallet,
    buildRecurringIncrease,
  ];
  return builders
    .map((build) => build(ctx))
    .filter((insight): insight is Insight => insight !== null && !ctx.dismissedIds.has(insight.id))
    .sort((a, b) => a.priority - b.priority);
}

// ── Dismissal state (local-only, settings store) ──────────────────────────

export async function getDismissedInsightIds(): Promise<Set<string>> {
  try {
    const entry = await db.settings.get(DISMISSED_INSIGHTS_KEY);
    const raw = typeof entry?.value === 'string' ? entry.value : '[]';
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export async function dismissInsight(insightId: string): Promise<void> {
  const dismissed = await getDismissedInsightIds();
  dismissed.add(insightId);
  await db.settings.put({ key: DISMISSED_INSIGHTS_KEY, value: JSON.stringify([...dismissed]) });
}
