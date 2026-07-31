/**
 * Tests for recurringService — occurrence math and idempotent processing.
 *
 * Covers master.md 7.3 duplicate-prevention requirements:
 * - Stable occurrence identity prevents duplicates on retry/reopen
 * - Pause and resume
 * - Editing a schedule
 * - Missed multiple occurrences
 * - Month-end dates
 * - Leap-year behavior
 * - Timezone-invariant (all logic uses local YYYY-MM-DD strings)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import {
  computeNextOccurrence,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  setScheduleActive,
  processDueSchedules,
  recordScheduleOccurrence,
  getUpcomingItems,
} from '@/services/recurringService';
import { setDebtReminder } from '@/services/debtService';

beforeEach(async () => {
  await db.transactions.clear();
  await db.wallets.clear();
  await db.categories.clear();
  await db.debts.clear();
  await db.debtPayments.clear();
  await db.schedules.clear();
  await db.settings.clear();
  await db.merchants.clear();
});

async function seedWallet(balance = 1_000_000): Promise<number> {
  const id = await db.wallets.add({
    name: 'Cash',
    currency: 'IDR',
    initialBalance: balance,
    currentBalance: balance,
    lastUpdated: '2025-01-01T00:00:00.000Z',
  });
  return id;
}

describe('computeNextOccurrence', () => {
  it('advances weekly by 7 days', () => {
    expect(computeNextOccurrence('2025-01-01', 'weekly', 1)).toBe('2025-01-08');
  });

  it('advances biweekly by 14 days', () => {
    expect(computeNextOccurrence('2025-01-01', 'biweekly', 1)).toBe('2025-01-15');
  });

  it('advances monthly and clamps to month end (anchor day 31)', () => {
    expect(computeNextOccurrence('2025-01-31', 'monthly', 31)).toBe('2025-02-28');
    expect(computeNextOccurrence('2025-02-28', 'monthly', 31)).toBe('2025-03-31');
    expect(computeNextOccurrence('2025-04-30', 'monthly', 31)).toBe('2025-05-31');
  });

  it('handles leap-year February for monthly recurrence', () => {
    expect(computeNextOccurrence('2024-01-31', 'monthly', 31)).toBe('2024-02-29');
    expect(computeNextOccurrence('2024-02-29', 'monthly', 29)).toBe('2024-03-29');
  });

  it('clamps yearly February 29 to February 28 in non-leap years', () => {
    expect(computeNextOccurrence('2024-02-29', 'yearly', 29)).toBe('2025-02-28');
  });

  it('handles yearly month-end clamping', () => {
    expect(computeNextOccurrence('2025-01-31', 'yearly', 31)).toBe('2026-01-31');
  });

  it('rolls over year boundaries for monthly', () => {
    expect(computeNextOccurrence('2025-12-15', 'monthly', 15)).toBe('2026-01-15');
  });

  it('is independent of the local timezone (string-date arithmetic)', () => {
    // master.md 7.3: occurrence math must not shift dates across timezones.
    const previousTz = process.env.TZ;
    const dates = ['2024-01-31', '2024-03-01', '2024-11-30'];
    try {
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
      const east = dates.map((d) => computeNextOccurrence(d, 'monthly', 31));
      process.env.TZ = 'America/Los_Angeles'; // UTC-8
      const west = dates.map((d) => computeNextOccurrence(d, 'monthly', 31));
      expect(west).toEqual(east);
      expect(east[0]).toBe('2024-02-29'); // leap year, anchor 31 clamped
    } finally {
      if (previousTz) process.env.TZ = previousTz;
      else delete process.env.TZ;
    }
  });
});

describe('schedule CRUD', () => {
  it('creates a schedule with start date as next occurrence', async () => {
    const walletId = await seedWallet();
    const id = await createSchedule({
      frequency: 'monthly',
      startDate: '2025-03-01',
      amount: 100000,
      categoryId: null,
      walletId,
      payee: 'Rent',
      mode: 'remind',
    });
    const schedule = await db.schedules.get(id);
    expect(schedule).toBeDefined();
    expect(schedule?.nextOccurrence).toBe('2025-03-01');
    expect(schedule?.active).toBe(true);
    expect(schedule?.mode).toBe('remind');
    expect(schedule?.lastProcessedOccurrence).toBeNull();
  });

  it('updates a schedule and preserves occurrence tracking (no duplicate reprocessing)', async () => {
    const walletId = await seedWallet();
    const id = await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-01',
      amount: 100000,
      categoryId: null,
      walletId,
      payee: 'Rent',
      mode: 'create',
    });
    await db.schedules.update(id, { lastProcessedOccurrence: `${id}:2025-03-01` });

    await updateSchedule(id, {
      frequency: 'monthly',
      startDate: '2025-04-01',
      amount: 200000,
      categoryId: null,
      walletId,
      payee: 'Rent',
      mode: 'create',
    });

    const schedule = await db.schedules.get(id);
    expect(schedule?.frequency).toBe('monthly');
    expect(schedule?.nextOccurrence).toBe('2025-04-01');
    // Last processed occurrence is preserved so editing cannot re-process it.
    expect(schedule?.lastProcessedOccurrence).toBe(`${id}:2025-03-01`);
    expect(schedule?.amount).toBe(200000);
  });

  it('editing a processed schedule does not create duplicate past occurrences', async () => {
    const walletId = await seedWallet(10_000_000);
    const id = await createSchedule({
      frequency: 'weekly',
      startDate: '2025-01-01',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'create',
    });

    // Process through Jan 8, then edit the schedule (e.g. change the amount).
    await processDueSchedules('2025-01-08');
    const before = await db.transactions.count();
    await updateSchedule(id, {
      frequency: 'weekly',
      startDate: '2025-01-01',
      amount: 60000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'create',
    });

    // Reprocessing must NOT duplicate the Jan 1/Jan 8 occurrences already created.
    await processDueSchedules('2025-01-08');
    const after = await db.transactions.count();
    expect(after).toBe(before);
  });

  it('deletes a schedule', async () => {
    const walletId = await seedWallet();
    const id = await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-01',
      amount: 100000,
      categoryId: null,
      walletId,
      payee: 'Rent',
      mode: 'remind',
    });
    await deleteSchedule(id);
    const schedule = await db.schedules.get(id);
    expect(schedule).toBeUndefined();
  });

  it('pauses and resumes a schedule', async () => {
    const walletId = await seedWallet();
    const id = await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-01',
      amount: 100000,
      categoryId: null,
      walletId,
      payee: 'Rent',
      mode: 'create',
    });
    await setScheduleActive(id, false);
    expect((await db.schedules.get(id))?.active).toBe(false);
    await setScheduleActive(id, true);
    expect((await db.schedules.get(id))?.active).toBe(true);
  });
});

describe('processDueSchedules (idempotent creation)', () => {
  it('creates exactly one transaction per due occurrence', async () => {
    const walletId = await seedWallet();
    await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-01',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'create',
    });

    const created = await processDueSchedules('2025-03-07');
    expect(created).toBe(1);

    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0].date).toBe('2025-03-01');
    expect(txs[0].description).toBe('Gym');
    expect(txs[0].amount).toBe(50000);
    expect(txs[0].type).toBe('expense');

    const wallet = await db.wallets.get(walletId);
    expect(wallet?.currentBalance).toBe(1_000_000 - 50000);
  });

  it('does not duplicate occurrences when processed again (reopen/retry)', async () => {
    const walletId = await seedWallet();
    await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-01',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'create',
    });

    await processDueSchedules('2025-03-07');
    await processDueSchedules('2025-03-07');
    await processDueSchedules('2025-03-14');

    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(2); // 2025-03-01 and 2025-03-08
  });

  it('creates multiple missed occurrences without duplicates', async () => {
    const walletId = await seedWallet(10_000_000);
    await createSchedule({
      frequency: 'weekly',
      startDate: '2025-01-01',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'create',
    });

    // App re-opened after a month: four missed weekly occurrences
    const created = await processDueSchedules('2025-01-29');
    expect(created).toBe(5); // Jan 1, 8, 15, 22, 29

    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(5);
    const dates = txs.map((t) => t.date).sort();
    expect(dates).toEqual(['2025-01-01', '2025-01-08', '2025-01-15', '2025-01-22', '2025-01-29']);
  });

  it('respects an end date', async () => {
    const walletId = await seedWallet(10_000_000);
    await createSchedule({
      frequency: 'weekly',
      startDate: '2025-01-01',
      endDate: '2025-01-15',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'create',
    });

    const created = await processDueSchedules('2025-02-01');
    expect(created).toBe(3); // Jan 1, 8, 15 (end date inclusive)
    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(3);
  });

  it('skips paused schedules', async () => {
    const walletId = await seedWallet();
    const id = await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-01',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'create',
    });
    await setScheduleActive(id, false);

    const created = await processDueSchedules('2025-03-15');
    expect(created).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it('does not process remind-mode schedules', async () => {
    const walletId = await seedWallet();
    await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-01',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'remind',
    });

    const created = await processDueSchedules('2025-03-15');
    expect(created).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it('stops without advancing when wallet balance is insufficient', async () => {
    const walletId = await seedWallet(30_000);
    const id = await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-01',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'create',
    });

    const created = await processDueSchedules('2025-03-15');
    expect(created).toBe(0);
    expect(await db.transactions.count()).toBe(0);

    // The schedule still shows the due occurrence in Upcoming
    const schedule = await db.schedules.get(id);
    expect(schedule?.nextOccurrence).toBe('2025-03-01');
  });
});

describe('recordScheduleOccurrence', () => {
  it('creates the occurrence transaction and advances the schedule', async () => {
    const walletId = await seedWallet();
    const id = await createSchedule({
      frequency: 'monthly',
      startDate: '2025-03-01',
      amount: 100000,
      categoryId: null,
      walletId,
      payee: 'Rent',
      mode: 'remind',
    });

    await recordScheduleOccurrence(id, '2025-03-01');

    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0].date).toBe('2025-03-01');

    const schedule = await db.schedules.get(id);
    expect(schedule?.nextOccurrence).toBe('2025-04-01');
    expect(schedule?.lastProcessedOccurrence).toBe(`${id}:2025-03-01`);
  });

  it('rejects recording for a paused schedule', async () => {
    const walletId = await seedWallet();
    const id = await createSchedule({
      frequency: 'monthly',
      startDate: '2025-03-01',
      amount: 100000,
      categoryId: null,
      walletId,
      payee: 'Rent',
      mode: 'remind',
    });
    await setScheduleActive(id, false);
    await expect(recordScheduleOccurrence(id, '2025-03-01')).rejects.toThrow(/paused/i);
  });
});

describe('getUpcomingItems', () => {
  it('shows remind-mode schedules due today and within 7 days', async () => {
    const walletId = await seedWallet();
    await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-10',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'remind',
    });

    const items = getUpcomingItems(await db.schedules.toArray(), [], {}, '2025-03-10');
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('schedule');
    expect(items[0].urgency).toBe('today');
  });

  it('does not show create-mode schedules already handled', async () => {
    const walletId = await seedWallet();
    const id = await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-10',
      amount: 50000,
      categoryId: null,
      walletId,
      payee: 'Gym',
      mode: 'create',
    });
    await processDueSchedules('2025-03-10');
    const schedule = await db.schedules.get(id);

    const items = getUpcomingItems([schedule!], [], {}, '2025-03-10');
    // next occurrence is 2025-03-17 (beyond 7-day horizon handling)
    expect(items).toHaveLength(0);
  });

  it('sorts overdue before today before soon', async () => {
    const walletId = await seedWallet();
    await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-01',
      amount: 10000,
      categoryId: null,
      walletId,
      payee: 'Old',
      mode: 'remind',
    });
    await createSchedule({
      frequency: 'weekly',
      startDate: '2025-03-16',
      amount: 10000,
      categoryId: null,
      walletId,
      payee: 'Soon',
      mode: 'remind',
    });

    const items = getUpcomingItems(await db.schedules.toArray(), [], {}, '2025-03-10');
    expect(items.map((i) => i.title)).toEqual(['Old', 'Soon']);
    expect(items[0].urgency).toBe('overdue');
    expect(items[1].urgency).toBe('soon');
  });

  it('includes debts whose reminder window has started', async () => {
    const walletId = await seedWallet();
    await db.debts.add({
      id: 'debt_1',
      type: 'payable',
      personName: 'Alice',
      principalAmount: 200000,
      remainingAmount: 200000,
      walletId,
      startDate: '2025-01-01',
      dueDate: '2025-03-15',
      status: 'open',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderDaysBefore: 7,
      reminderPostponedUntil: null,
    });

    const items = getUpcomingItems([], await db.debts.toArray(), {}, '2025-03-10');
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('debt');
    expect(items[0].title).toBe('Alice');
    expect(items[0].urgency).toBe('soon');
  });

  it('excludes debts with reminders disabled or postponed', async () => {
    const walletId = await seedWallet();
    await db.debts.bulkAdd([
      {
        id: 'debt_disabled', type: 'payable', personName: 'No Reminder',
        principalAmount: 100000, remainingAmount: 100000, walletId,
        startDate: '2025-01-01', dueDate: '2025-03-10', status: 'open',
        createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', archivedAt: null,
        reminderDaysBefore: null, reminderPostponedUntil: null,
      },
      {
        id: 'debt_postponed', type: 'receivable', personName: 'Postponed',
        principalAmount: 100000, remainingAmount: 100000, walletId,
        startDate: '2025-01-01', dueDate: '2025-03-10', status: 'open',
        createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', archivedAt: null,
        reminderDaysBefore: 7, reminderPostponedUntil: '2025-03-20',
      },
    ]);

    const items = getUpcomingItems([], await db.debts.toArray(), {}, '2025-03-10');
    expect(items).toHaveLength(0);
  });

  it('shows overdue debts even when reminder window preference is narrow', async () => {
    const walletId = await seedWallet();
    await db.debts.add({
      id: 'debt_overdue',
      type: 'payable',
      personName: 'Overdue',
      principalAmount: 100000,
      remainingAmount: 100000,
      walletId,
      startDate: '2025-01-01',
      dueDate: '2025-03-01',
      status: 'overdue',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderDaysBefore: 0,
      reminderPostponedUntil: null,
    });
    // A debt whose reminder is disabled should not appear even when overdue
    await db.debts.add({
      id: 'debt_off',
      type: 'payable',
      personName: 'Disabled Overdue',
      principalAmount: 100000,
      remainingAmount: 100000,
      walletId,
      startDate: '2025-01-01',
      dueDate: '2025-02-01',
      status: 'overdue',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderDaysBefore: null,
      reminderPostponedUntil: null,
    });

    const items = getUpcomingItems([], await db.debts.toArray(), {}, '2025-03-10');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Overdue');
  });

  it('respects reminder preference changes', async () => {
    const walletId = await seedWallet();
    await db.debts.add({
      id: 'debt_pref',
      type: 'payable',
      personName: 'Pref',
      principalAmount: 100000,
      remainingAmount: 100000,
      walletId,
      startDate: '2025-01-01',
      dueDate: '2025-03-20',
      status: 'open',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderDaysBefore: 7,
      reminderPostponedUntil: null,
    });

    // Not yet in window at 2025-03-10 (due 03-20, window starts 03-13)
    expect(getUpcomingItems([], await db.debts.toArray(), {}, '2025-03-10')).toHaveLength(0);
    // In window from 03-13
    expect(getUpcomingItems([], await db.debts.toArray(), {}, '2025-03-13')).toHaveLength(1);

    // Disabling removes it
    await setDebtReminder('debt_pref', null);
    expect(getUpcomingItems([], await db.debts.toArray(), {}, '2025-03-15')).toHaveLength(0);
  });
});
