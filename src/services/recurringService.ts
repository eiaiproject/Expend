import { db, type Debt, type DebtPayment, type Schedule, type ScheduleFrequency, type ScheduleMode } from '../db/db';
import { assertWalletBalanceCanApplyDelta, getBalanceDelta, getWalletBalance } from '../utils/balanceUtils';
import { getTodayStr, normaliseDate } from '../utils/dateUtils';
import { INSUFFICIENT_WALLET_BALANCE_MESSAGE } from './errors';
import { incrementChangeCount } from './backupService';
import { calculateDebtStatus, shouldRemindDebt } from './debtService';

const WALLET_NOT_FOUND_MESSAGE = 'Wallet not found.';

/** Safety cap: maximum occurrences created per schedule per processing run. */
const MAX_OCCURRENCES_PER_RUN = 100;

export interface CreateScheduleParams {
  frequency: ScheduleFrequency;
  startDate: string;
  endDate?: string | null;
  amount: number;
  categoryId: number | null;
  walletId: number;
  payee?: string;
  notes?: string;
  mode: ScheduleMode;
  active?: boolean;
}

export interface UpdateScheduleParams {
  frequency: ScheduleFrequency;
  startDate: string;
  endDate?: string | null;
  amount: number;
  categoryId: number | null;
  walletId: number;
  payee?: string;
  notes?: string;
  mode: ScheduleMode;
  active?: boolean;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; // NOSONAR
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseDateOnly(dateStr: string): { y: number; m: number; d: number } {
  const [yRaw, mRaw, dRaw] = dateStr.split('-');
  return { y: Number(yRaw), m: Number(mRaw), d: Number(dRaw) };
}

function toDateStr(date: Date): string {
  return getTodayStr(date);
}

function lastDayOfMonth(year: number, month: number): number {
  // month is 1-based; day 0 of next month = last day of `month`
  return new Date(year, month, 0).getDate();
}

function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDateOnly(dateStr);
  return toDateStr(new Date(y, m - 1, d + days));
}

/**
 * Compute the occurrence date following `currentDate` for a given frequency.
 *
 * Monthly/yearly recurrences keep an anchor day (typically the day of the
 * schedule's start date) and clamp to the last day of the target month, so a
 * Jan 31 schedule lands on Feb 28/29 and then back to Mar 31 without drifting.
 */
export function computeNextOccurrence(
  currentDate: string,
  frequency: ScheduleFrequency,
  anchorDay: number,
): string {
  const { y, m, d } = parseDateOnly(currentDate);

  if (frequency === 'weekly') {
    return addDays(currentDate, 7);
  }
  if (frequency === 'biweekly') {
    return addDays(currentDate, 14);
  }
  if (frequency === 'monthly') {
    const targetMonth = m === 12 ? 1 : m + 1;
    const targetYear = m === 12 ? y + 1 : y;
    const day = Math.min(anchorDay, lastDayOfMonth(targetYear, targetMonth));
    return `${targetYear}-${pad(targetMonth)}-${pad(day)}`;
  }
  // yearly
  const day = Math.min(anchorDay, lastDayOfMonth(y + 1, m));
  return `${y + 1}-${pad(m)}-${pad(day)}`;
}

function assertValidSchedule(params: CreateScheduleParams | UpdateScheduleParams): void {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error('Schedule amount must be greater than 0.');
  }
  if (!Number.isSafeInteger(params.walletId) || params.walletId <= 0) {
    throw new Error('Select a wallet for this schedule.');
  }
  if (!params.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(normaliseDate(params.startDate))) {
    throw new Error('Schedule start date is required.');
  }
  if (!params.payee?.trim()) {
    throw new Error('Schedule description is required.');
  }
  const endDate = params.endDate ? normaliseDate(params.endDate) : null;
  if (endDate && endDate < normaliseDate(params.startDate)) {
    throw new Error('End date cannot be before the start date.');
  }
}

/** Build the expense transaction inside an atomic transaction that also advances the schedule. */
async function createOccurrenceAndAdvance(schedule: Schedule, occurrenceDate: string, nextOccurrence: string): Promise<void> {
  const now = new Date().toISOString();
  const occurrenceId = `${schedule.id}:${occurrenceDate}`;

  await db.transaction('rw', [db.transactions, db.wallets, db.schedules], async () => {
    const wallet = await db.wallets.get(schedule.walletId);
    if (!wallet) throw new Error(WALLET_NOT_FOUND_MESSAGE);

    const delta = getBalanceDelta('expense', schedule.amount);
    assertWalletBalanceCanApplyDelta(wallet, delta, INSUFFICIENT_WALLET_BALANCE_MESSAGE);

    await db.transactions.add({
      amount: schedule.amount,
      description: schedule.payee?.trim() ?? '',
      date: occurrenceDate,
      walletId: schedule.walletId,
      categoryId: schedule.categoryId,
      notes: schedule.notes?.trim() || undefined,
      type: 'expense',
    });
    await db.wallets.update(schedule.walletId, {
      currentBalance: getWalletBalance(wallet) + delta,
      lastUpdated: now,
    });
    await db.schedules.update(schedule.id, {
      nextOccurrence,
      lastProcessedOccurrence: occurrenceId,
      updatedAt: now,
    });
  });

  await incrementChangeCount(1);
}

export async function createSchedule(params: CreateScheduleParams): Promise<string> {
  assertValidSchedule(params);

  const now = new Date().toISOString();
  const startDate = normaliseDate(params.startDate);
  const schedule: Schedule = {
    id: createId('schedule'),
    type: 'expense',
    frequency: params.frequency,
    startDate,
    nextOccurrence: startDate,
    endDate: params.endDate ? normaliseDate(params.endDate) : null,
    amount: params.amount,
    categoryId: params.categoryId,
    walletId: params.walletId,
    payee: params.payee?.trim(),
    notes: params.notes?.trim() || undefined,
    mode: params.mode,
    active: params.active ?? true,
    lastProcessedOccurrence: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.schedules.add(schedule);
  await incrementChangeCount(1);
  return schedule.id;
}

/** First occurrence of a schedule at or after `targetDate` (used on edits). */
function firstOccurrenceOnOrAfter(targetDate: string, frequency: ScheduleFrequency, startDate: string): string {
  const anchorDay = parseDateOnly(startDate).d;
  let occurrence = startDate;
  let guard = 0;
  while (occurrence < targetDate && guard < 1000) {
    occurrence = computeNextOccurrence(occurrence, frequency, anchorDay);
    guard += 1;
  }
  return occurrence;
}

export async function updateSchedule(id: string, params: UpdateScheduleParams): Promise<void> {
  assertValidSchedule(params);

  const existing = await db.schedules.get(id);
  if (!existing) throw new Error('Schedule not found.');

  const startDate = normaliseDate(params.startDate);
  const now = new Date().toISOString();

  // Duplicate prevention (master.md 7.3): never move nextOccurrence backward.
  // - A schedule that already processed occurrences keeps its timing so an edit
  //   (amount/payee/wallet/etc.) can never re-process past occurrences.
  // - Only schedules that have never been processed get a fresh next occurrence
  //   computed from the new parameters, anchored to today.
  let nextOccurrence: string;
  let lastProcessedOccurrence: string | null;
  if (existing.lastProcessedOccurrence !== null) {
    nextOccurrence = existing.nextOccurrence > startDate ? existing.nextOccurrence : startDate;
    lastProcessedOccurrence = existing.lastProcessedOccurrence;
  } else {
    nextOccurrence = firstOccurrenceOnOrAfter(getTodayStr(), params.frequency, startDate);
    lastProcessedOccurrence = null;
  }

  await db.schedules.update(id, {
    frequency: params.frequency,
    startDate,
    nextOccurrence,
    endDate: params.endDate ? normaliseDate(params.endDate) : null,
    amount: params.amount,
    categoryId: params.categoryId,
    walletId: params.walletId,
    payee: params.payee?.trim(),
    notes: params.notes?.trim() || undefined,
    mode: params.mode,
    active: params.active ?? existing.active,
    lastProcessedOccurrence,
    updatedAt: now,
  });
  await incrementChangeCount(1);
}

export async function deleteSchedule(id: string): Promise<void> {
  await db.schedules.delete(id);
  await incrementChangeCount(1);
}

export async function setScheduleActive(id: string, active: boolean): Promise<void> {
  await db.schedules.update(id, {
    active,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Process all due 'create'-mode schedules for `today`.
 *
 * Idempotent by design: an occurrence is only created when its stable identity
 * (`scheduleId:YYYY-MM-DD`) differs from the schedule's last processed
 * occurrence, and the transaction creation + schedule advance happen in one
 * atomic IndexedDB transaction. Retrying (reopen, pause/resume, crash) can
 * never duplicate an occurrence.
 *
 * Returns the number of transactions created.
 */
export async function processDueSchedules(today = getTodayStr()): Promise<number> {
  const schedules = await db.schedules.toArray();
  let createdCount = 0;

  for (const schedule of schedules) {
    if (!schedule.active || schedule.mode !== 'create') continue;
    const anchorDay = parseDateOnly(schedule.startDate).d;
    const endDate = schedule.endDate ?? null;

    let next = schedule.nextOccurrence;
    let lastProcessed = schedule.lastProcessedOccurrence;
    let created = 0;

    while (
      next <= today &&
      (!endDate || next <= endDate) &&
      created < MAX_OCCURRENCES_PER_RUN
    ) {
      const occurrenceId = `${schedule.id}:${next}`;
      if (occurrenceId !== lastProcessed) {
        const following = computeNextOccurrence(next, schedule.frequency, anchorDay);
        try {
          await createOccurrenceAndAdvance(schedule, next, following);
        } catch {
          // Insufficient balance, wallet archived/deleted, etc. Leave the
          // occurrence due so it stays visible in Upcoming and retries on the
          // next open.
          break;
        }
        lastProcessed = occurrenceId;
        created += 1;
      } else {
        lastProcessed = null; // defensive: identity matches but we still advance below
      }
      next = computeNextOccurrence(next, schedule.frequency, anchorDay);
    }

    if (created > 0) {
      createdCount += created;
    }
  }

  return createdCount;
}

/**
 * Record a schedule occurrence now (used by the Upcoming section and the
 * Schedules view for 'remind'-mode schedules). Creates the expense transaction
 * for the given occurrence date and advances the schedule atomically.
 */
export async function recordScheduleOccurrence(scheduleId: string, occurrenceDate = getTodayStr()): Promise<void> {
  const schedule = await db.schedules.get(scheduleId);
  if (!schedule) throw new Error('Schedule not found.');
  if (!schedule.active) throw new Error('Schedule is paused.');

  const anchorDay = parseDateOnly(schedule.startDate).d;
  const following = computeNextOccurrence(occurrenceDate, schedule.frequency, anchorDay);
  await createOccurrenceAndAdvance(schedule, normaliseDate(occurrenceDate), following);
}

export interface UpcomingScheduleItem {
  kind: 'schedule';
  id: string;
  scheduleId: string;
  date: string; // next occurrence
  title: string;
  amount: number;
  frequency: ScheduleFrequency;
  mode: ScheduleMode;
  urgency: 'overdue' | 'today' | 'soon';
  /** Route to open when the item is tapped. */
  target: string;
}

export interface UpcomingDebtItem {
  kind: 'debt';
  id: string;
  debtId: string;
  date: string; // due date
  title: string;
  amount: number; // remaining amount
  type: Debt['type'];
  urgency: 'overdue' | 'today' | 'soon';
  /** Route to open when the item is tapped. */
  target: string;
}

export type UpcomingItem = UpcomingScheduleItem | UpcomingDebtItem;

function urgencyFor(date: string, today: string): UpcomingItem['urgency'] {
  if (date < today) return 'overdue';
  if (date === today) return 'today';
  return 'soon';
}

/**
 * Build the compact Upcoming list shown on Home (master.md 7.4).
 *
 * Includes:
 * - Active schedules whose next occurrence is overdue, today, or within the
 *   next 7 days ('remind' mode, plus 'create' mode occurrences that are still
 *   due because processing failed).
 * - Debts/receivables whose due date falls within their reminder window.
 *
 * Sorted by urgency (overdue first), then by date.
 */
export function getUpcomingItems(
  schedules: readonly Schedule[],
  debts: readonly Debt[],
  paymentsByDebt: Record<string, readonly DebtPayment[]>,
  today = getTodayStr(),
): UpcomingItem[] {
  const horizon = addDays(today, 7);
  const items: UpcomingItem[] = [];

  for (const schedule of schedules) {
    if (!schedule.active) continue;
    const endDate = schedule.endDate ?? null;
    if (endDate && schedule.nextOccurrence > endDate) continue;
    if (schedule.nextOccurrence > horizon) continue;
    const stillDueForCreate = schedule.mode === 'create' && schedule.nextOccurrence <= today;
    const showForRemind = schedule.mode === 'remind' && schedule.nextOccurrence <= horizon;
    if (!stillDueForCreate && !showForRemind) continue;

    items.push({
      kind: 'schedule',
      id: `schedule-${schedule.id}`,
      scheduleId: schedule.id,
      date: schedule.nextOccurrence,
      title: schedule.payee?.trim() || schedule.notes?.trim() || '',
      amount: schedule.amount,
      frequency: schedule.frequency,
      mode: schedule.mode,
      urgency: urgencyFor(schedule.nextOccurrence, today),
      target: '/schedules',
    });
  }

  for (const debt of debts) {
    if (!shouldRemindDebt(debt, today)) continue;
    const dueDate = debt.dueDate!;
    const status = calculateDebtStatus(debt, paymentsByDebt[debt.id] ?? []);
    if (status === 'paid' || status === 'written_off') continue;

    items.push({
      kind: 'debt',
      id: `debt-${debt.id}`,
      debtId: debt.id,
      date: dueDate,
      title: debt.personName,
      amount: debt.remainingAmount,
      type: debt.type,
      urgency: urgencyFor(dueDate, today),
      target: '/debts',
    });
  }

  const urgencyRank = { overdue: 0, today: 1, soon: 2 } as const;
  return items.sort((a, b) => {
    const rankDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (rankDiff !== 0) return rankDiff;
    return a.date.localeCompare(b.date);
  });
}
