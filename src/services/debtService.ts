import { db, type Debt, type DebtPayment, type DebtStatus, type DebtType } from '../db/db';
import { getTodayStr, normaliseDate } from '../utils/dateUtils';
import { assertWalletBalanceCanApplyDelta, getWalletBalance } from '../utils/balanceUtils';
import { DEBT_ERROR_MESSAGES, DEBT_PAYMENT_NOTE_KEYS, INSUFFICIENT_WALLET_BALANCE_MESSAGE } from './errors';
import { incrementChangeCount } from './backupService';
import { recordSupportMilestone } from './supportService';

export interface CreateDebtParams {
  type: DebtType;
  personName: string;
  title?: string;
  principalAmount: number;
  walletId: number;
  startDate: string;
  dueDate?: string | null;
  notes?: string;
}

export interface UpdateDebtParams {
  personName: string;
  title?: string;
  principalAmount: number;
  walletId: number;
  startDate: string;
  dueDate?: string | null;
  notes?: string;
}

export interface RecordDebtPaymentParams {
  debtId: string;
  amount: number;
  walletId: number;
  date: string;
  notes?: string;
}

export interface DebtSummary {
  payableTotal: number;
  receivableTotal: number;
  netPosition: number;
  overdueCount: number;
  dueSoonCount: number;
  attentionCount: number;
  activeCount: number;
  paidCount: number;
}

const MONEY_EPSILON = 0.0001;

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; // NOSONAR
}

function addDaysStr(dateStr: string, days: number): string {
  const [yearRaw, monthRaw, dayRaw] = dateStr.split('-');
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
  date.setDate(date.getDate() + days);
  return getTodayStr(date);
}

function normalizeDueDate(dueDate?: string | null): string | null {
  if (!dueDate) return null;
  return normaliseDate(dueDate);
}

function initialWalletDelta(type: DebtType, amount: number): number {
  return type === 'payable' ? amount : -amount;
}

function repaymentWalletDelta(type: DebtType, amount: number): number {
  return type === 'payable' ? -amount : amount;
}

function assertValidDebtInput(params: CreateDebtParams | UpdateDebtParams): void {
  if (!params.personName.trim()) {
    throw new Error(DEBT_ERROR_MESSAGES.personNameRequired);
  }
  if (!Number.isFinite(params.principalAmount) || params.principalAmount <= 0) {
    throw new Error(DEBT_ERROR_MESSAGES.amountRequired);
  }
  if (!Number.isSafeInteger(params.walletId) || params.walletId <= 0) {
    throw new Error(DEBT_ERROR_MESSAGES.walletRequired);
  }
  if (!params.startDate) {
    throw new Error(DEBT_ERROR_MESSAGES.startDateRequired);
  }
  const dueDate = normalizeDueDate(params.dueDate);
  if (dueDate && dueDate < normaliseDate(params.startDate)) {
    throw new Error(DEBT_ERROR_MESSAGES.dueDateBeforeStartDate);
  }
}

async function applyWalletDelta(walletId: number, delta: number): Promise<void> {
  const wallet = await db.wallets.get(walletId);
  if (!wallet) {
    throw new Error(DEBT_ERROR_MESSAGES.walletNotFound);
  }

  assertWalletBalanceCanApplyDelta(wallet, delta, INSUFFICIENT_WALLET_BALANCE_MESSAGE);

  await db.wallets.update(walletId, {
    currentBalance: getWalletBalance(wallet) + delta,
    lastUpdated: new Date().toISOString(),
  });
}

export function calculateDebtStatus(
  debt: Pick<Debt, 'remainingAmount' | 'principalAmount' | 'dueDate' | 'status'>,
  payments: readonly Pick<DebtPayment, 'type'>[] = [],
  today = getTodayStr(),
): DebtStatus {
  if (debt.status === 'written_off') return 'written_off';
  if (debt.remainingAmount <= MONEY_EPSILON) return 'paid';

  const dueDate = normalizeDueDate(debt.dueDate);
  if (dueDate && dueDate < today) return 'overdue';

  const hasRepayment = payments.some((payment) => payment.type === 'repayment');
  if (hasRepayment || debt.remainingAmount < debt.principalAmount - MONEY_EPSILON) {
    return 'partial';
  }

  return 'open';
}

export function isDebtClosed(status: DebtStatus): boolean {
  return status === 'paid' || status === 'written_off';
}

export function buildDebtPaymentsMap(payments: readonly DebtPayment[]): Record<string, DebtPayment[]> {
  return payments.reduce<Record<string, DebtPayment[]>>((acc, payment) => {
    acc[payment.debtId] = [...(acc[payment.debtId] ?? []), payment];
    return acc;
  }, {});
}

export function summarizeDebts(
  debts: readonly Debt[],
  paymentsByDebt: Record<string, readonly DebtPayment[]> = {},
  today = getTodayStr(),
): DebtSummary {
  const weekAhead = addDaysStr(today, 7);

  return debts.reduce<DebtSummary>((summary, debt) => {
    if (debt.archivedAt) return summary;

    const status = calculateDebtStatus(debt, paymentsByDebt[debt.id] ?? [], today);
    if (status === 'paid' || status === 'written_off') {
      summary.paidCount += 1;
      return summary;
    }

    summary.activeCount += 1;
    if (debt.type === 'payable') {
      summary.payableTotal += debt.remainingAmount;
    } else {
      summary.receivableTotal += debt.remainingAmount;
    }

    const dueDate = normalizeDueDate(debt.dueDate);
    if (status === 'overdue') {
      summary.overdueCount += 1;
    } else if (dueDate && dueDate >= today && dueDate <= weekAhead) {
      summary.dueSoonCount += 1;
    }

    summary.netPosition = summary.receivableTotal - summary.payableTotal;
    summary.attentionCount = summary.overdueCount + summary.dueSoonCount;
    return summary;
  }, {
    payableTotal: 0,
    receivableTotal: 0,
    netPosition: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    attentionCount: 0,
    activeCount: 0,
    paidCount: 0,
  });
}

export async function createDebt(params: CreateDebtParams): Promise<string> {
  assertValidDebtInput(params);

  const now = new Date().toISOString();
  const debtId = createId('debt');
  const paymentId = createId('debt_payment');
  const dueDate = normalizeDueDate(params.dueDate);

  await db.transaction('rw', [db.debts, db.debtPayments, db.wallets], async () => {
    const wallet = await db.wallets.get(params.walletId);
    if (!wallet) throw new Error(DEBT_ERROR_MESSAGES.walletNotFound);

    const debt: Debt = {
      id: debtId,
      type: params.type,
      personName: params.personName.trim(),
      title: params.title?.trim() || undefined,
      principalAmount: params.principalAmount,
      remainingAmount: params.principalAmount,
      walletId: params.walletId,
      startDate: normaliseDate(params.startDate),
      dueDate,
      status: calculateDebtStatus({
        principalAmount: params.principalAmount,
        remainingAmount: params.principalAmount,
        dueDate,
        status: 'open',
      }),
      notes: params.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      reminderDaysBefore: DEBT_DEFAULT_REMINDER_DAYS,
      reminderPostponedUntil: null,
    };

    const payment: DebtPayment = {
      id: paymentId,
      debtId,
      amount: params.principalAmount,
      date: normaliseDate(params.startDate),
      walletId: params.walletId,
      type: 'initial',
      notes: params.type === 'payable' ? DEBT_PAYMENT_NOTE_KEYS.loanReceived : DEBT_PAYMENT_NOTE_KEYS.loanGiven,
      linkedTransactionId: null,
      createdAt: now,
    };

    await db.debts.add(debt);
    await db.debtPayments.add(payment);
    await applyWalletDelta(params.walletId, initialWalletDelta(params.type, params.principalAmount));
  });

  // Track the debt creation for backup metadata
  await incrementChangeCount(2);

  return debtId;
}

export async function updateDebt(debtId: string, params: UpdateDebtParams): Promise<void> {
  assertValidDebtInput(params);

  await db.transaction('rw', [db.debts, db.debtPayments, db.wallets], async () => {
    const debt = await db.debts.get(debtId);
    if (!debt || debt.archivedAt) throw new Error(DEBT_ERROR_MESSAGES.debtNotFound);

    const payments = await db.debtPayments.where('debtId').equals(debtId).toArray();
    const hasActivity = payments.some((payment) => payment.type !== 'initial');
    const amountChanged = Math.abs(params.principalAmount - debt.principalAmount) > MONEY_EPSILON;
    const walletChanged = params.walletId !== debt.walletId;

    if (hasActivity && (amountChanged || walletChanged)) {
      throw new Error(DEBT_ERROR_MESSAGES.lockedAfterPayment);
    }

    if (!hasActivity && (amountChanged || walletChanged)) {
      await applyWalletDelta(debt.walletId, -initialWalletDelta(debt.type, debt.principalAmount));
      await applyWalletDelta(params.walletId, initialWalletDelta(debt.type, params.principalAmount));

      const initialPayment = payments.find((payment) => payment.type === 'initial');
      if (initialPayment) {
        await db.debtPayments.update(initialPayment.id, {
          amount: params.principalAmount,
          walletId: params.walletId,
          date: normaliseDate(params.startDate),
        });
      }
    }

    const dueDate = normalizeDueDate(params.dueDate);
    const nextDebt: Debt = {
      ...debt,
      personName: params.personName.trim(),
      title: params.title?.trim() || undefined,
      principalAmount: hasActivity ? debt.principalAmount : params.principalAmount,
      remainingAmount: hasActivity ? debt.remainingAmount : params.principalAmount,
      walletId: hasActivity ? debt.walletId : params.walletId,
      startDate: normaliseDate(params.startDate),
      dueDate,
      notes: params.notes?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    await db.debts.put({
      ...nextDebt,
      status: calculateDebtStatus(nextDebt, payments),
    });
  });

  // Track the debt update for backup metadata
  await incrementChangeCount(1);
}

export async function recordDebtPayment(params: RecordDebtPaymentParams): Promise<void> {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error(DEBT_ERROR_MESSAGES.paymentAmountRequired);
  }
  if (!params.date) {
    throw new Error(DEBT_ERROR_MESSAGES.paymentDateRequired);
  }

  await db.transaction('rw', [db.debts, db.debtPayments, db.wallets], async () => {
    const debt = await db.debts.get(params.debtId);
    if (!debt || debt.archivedAt) throw new Error(DEBT_ERROR_MESSAGES.debtNotFound);

    const existingPayments = await db.debtPayments.where('debtId').equals(params.debtId).toArray();
    const currentStatus = calculateDebtStatus(debt, existingPayments);
    if (isDebtClosed(currentStatus)) {
      throw new Error(DEBT_ERROR_MESSAGES.closedDebtPayment);
    }
    if (params.amount > debt.remainingAmount + MONEY_EPSILON) {
      throw new Error(DEBT_ERROR_MESSAGES.paymentExceedsRemaining);
    }

    const now = new Date().toISOString();
    const remainingAmount = Math.max(0, debt.remainingAmount - params.amount);
    const payment: DebtPayment = {
      id: createId('debt_payment'),
      debtId: debt.id,
      amount: params.amount,
      date: normaliseDate(params.date),
      walletId: params.walletId,
      type: 'repayment',
      notes: params.notes?.trim() || undefined,
      linkedTransactionId: null,
      createdAt: now,
    };

    const updatedDebt = {
      ...debt,
      remainingAmount,
      updatedAt: now,
    };

    await db.debtPayments.add(payment);
    await db.debts.update(debt.id, {
      remainingAmount,
      status: calculateDebtStatus(updatedDebt, [...existingPayments, payment]),
      updatedAt: now,
    });
    await applyWalletDelta(params.walletId, repaymentWalletDelta(debt.type, params.amount));
  });

  // Track the debt payment for backup metadata
  await incrementChangeCount(1);
}

export async function markDebtPaidWithoutCashflow(debtId: string, notes?: string): Promise<void> {
  let changed = false;
  await db.transaction('rw', [db.debts, db.debtPayments], async () => {
    const debt = await db.debts.get(debtId);
    if (!debt || debt.archivedAt) throw new Error(DEBT_ERROR_MESSAGES.debtNotFound);

    const existingPayments = await db.debtPayments.where('debtId').equals(debtId).toArray();
    const currentStatus = calculateDebtStatus(debt, existingPayments);
    if (isDebtClosed(currentStatus)) return;

    const now = new Date().toISOString();
    await db.debtPayments.add({
      id: createId('debt_payment'),
      debtId,
      amount: debt.remainingAmount,
      date: getTodayStr(),
      walletId: debt.walletId,
      type: 'adjustment',
      notes: notes?.trim() || DEBT_PAYMENT_NOTE_KEYS.markedPaidNoCashflow,
      linkedTransactionId: null,
      createdAt: now,
    });
    await db.debts.update(debtId, {
      remainingAmount: 0,
      status: 'paid',
      updatedAt: now,
    });
    changed = true;
  });

  // Track the mark-as-paid for backup metadata (only when a change occurred)
  if (changed) await incrementChangeCount(1);
  // Positive moment → make the contextual support prompt eligible (9.4)
  if (changed) await recordSupportMilestone('debt-settled');
}

export async function writeOffReceivable(debtId: string, notes?: string): Promise<void> {
  let changed = false;
  await db.transaction('rw', [db.debts, db.debtPayments], async () => {
    const debt = await db.debts.get(debtId);
    if (!debt || debt.archivedAt) throw new Error(DEBT_ERROR_MESSAGES.debtNotFound);
    if (debt.type !== 'receivable') throw new Error(DEBT_ERROR_MESSAGES.writeOffOnlyReceivable);

    const existingPayments = await db.debtPayments.where('debtId').equals(debtId).toArray();
    const currentStatus = calculateDebtStatus(debt, existingPayments);
    if (isDebtClosed(currentStatus)) return;

    const now = new Date().toISOString();
    await db.debtPayments.add({
      id: createId('debt_payment'),
      debtId,
      amount: debt.remainingAmount,
      date: getTodayStr(),
      walletId: debt.walletId,
      type: 'write_off',
      notes: notes?.trim() || DEBT_PAYMENT_NOTE_KEYS.writtenOffNoCashflow,
      linkedTransactionId: null,
      createdAt: now,
    });
    await db.debts.update(debtId, {
      remainingAmount: 0,
      status: 'written_off',
      updatedAt: now,
    });
    changed = true;
  });

  // Track the write-off for backup metadata (only when a change occurred)
  if (changed) await incrementChangeCount(1);
  // Positive moment → make the contextual support prompt eligible (9.4)
  if (changed) await recordSupportMilestone('debt-settled');
}

export async function archiveDebt(debtId: string): Promise<void> {
  await db.debts.update(debtId, {
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Track the debt archive for backup metadata
  await incrementChangeCount(1);
}

// ── Debt reminders (master.md 7.5) ───────────────────────────

/** Default reminder window: remind from 7 days before the due date. */
export const DEBT_DEFAULT_REMINDER_DAYS = 7;

/**
 * Whether a debt should appear in the Upcoming section today.
 *
 * A debt is eligible when:
 * - It is not archived or closed.
 * - It has a due date.
 * - Reminders are not disabled for it (reminderDaysBefore !== null).
 * - Its reminder window has started (due date minus preference days <= today),
 *   which also covers overdue debts.
 * - Its reminder has not been postponed past today.
 */
export function shouldRemindDebt(debt: Pick<Debt, 'archivedAt' | 'dueDate' | 'reminderDaysBefore' | 'reminderPostponedUntil' | 'remainingAmount' | 'status'>, today = getTodayStr()): boolean {
  if (debt.archivedAt) return false;
  if (!debt.dueDate) return false;
  if (debt.reminderDaysBefore === null) return false;
  if (debt.remainingAmount <= MONEY_EPSILON) return false;
  if (debt.status === 'written_off') return false;
  if (debt.reminderPostponedUntil && debt.reminderPostponedUntil > today) return false;

  // null disables; undefined (pre-existing debts) falls back to the default window.
  const daysBefore = debt.reminderDaysBefore ?? DEBT_DEFAULT_REMINDER_DAYS;
  const remindFrom = addDaysStr(debt.dueDate, -daysBefore);
  return today >= remindFrom;
}

/**
 * Set (or disable) the reminder window for a debt.
 * `daysBefore` is the number of days before the due date to start reminding
 * (e.g. 7, 3, 0 for the due date itself). Pass null to disable reminders.
 */
export async function setDebtReminder(debtId: string, daysBefore: number | null): Promise<void> {
  await db.debts.update(debtId, {
    reminderDaysBefore: daysBefore,
    reminderPostponedUntil: null,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Postpone a debt's reminder for `days` (default 7).
 * Keeps the reminder enabled but suppresses it until the postponed date.
 */
export async function postponeDebtReminder(debtId: string, days = 7): Promise<void> {
  await db.debts.update(debtId, {
    reminderPostponedUntil: addDaysStr(getTodayStr(), days),
    updatedAt: new Date().toISOString(),
  });
}
