/**
 * Unit tests for the support service (master.md section 9.4 / 9.5).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import {
  getSupportPromptState,
  recordSupportMilestone,
  recordSupportPromptShown,
  dismissSupportPrompt,
  recordSupportClick,
  suppressSupportPrompts,
  evaluateSupportPrompt,
  type SupportPromptState,
} from '../../src/services/supportService';

const BASE_STATE: SupportPromptState = {
  lastPromptShownAt: null,
  lastPromptDismissedAt: null,
  supportClickedAt: null,
  permanentlySuppressed: false,
  promptedMilestones: [],
  milestoneEvents: {},
};

const NOW = new Date('2026-07-31T12:00:00.000Z');

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function evalState(overrides: Partial<SupportPromptState>, opts?: {
  txCount?: number;
  hasBackup?: boolean;
  firstTransactionDate?: string | null;
}) {
  return evaluateSupportPrompt({
    state: { ...BASE_STATE, ...overrides },
    now: NOW,
    txCount: opts?.txCount ?? 5,
    hasBackup: opts?.hasBackup ?? false,
    firstTransactionDate: opts?.firstTransactionDate ?? daysAgo(20).slice(0, 10),
  });
}

beforeEach(async () => {
  await db.settings.clear();
});

describe('evaluateSupportPrompt', () => {
  it('never shows before the first completed transaction', () => {
    const result = evalState({}, { txCount: 0 });
    expect(result.show).toBe(false);
    expect(result.milestoneKey).toBeNull();
  });

  it('shows for first successful backup even without 14 days of use', () => {
    const result = evalState({}, { hasBackup: true, firstTransactionDate: daysAgo(2).slice(0, 10) });
    expect(result.show).toBe(true);
    expect(result.milestoneKey).toBe('first-backup');
  });

  it('shows for 30 days of meaningful use', () => {
    const result = evalState({}, { firstTransactionDate: daysAgo(31).slice(0, 10) });
    expect(result.show).toBe(true);
    expect(result.milestoneKey).toBe('30-days');
  });

  it('does not show 30-day milestone before 30 days', () => {
    const result = evalState({}, { firstTransactionDate: daysAgo(10).slice(0, 10) });
    expect(result.show).toBe(false);
  });

  it('shows for 100 transactions with meaningful use', () => {
    const result = evalState({}, { txCount: 100 });
    expect(result.show).toBe(true);
    expect(result.milestoneKey).toBe('100-tx');
  });

  it('does not show 100-tx milestone without 14 days meaningful use', () => {
    const result = evalState({}, { txCount: 100, firstTransactionDate: daysAgo(3).slice(0, 10) });
    expect(result.show).toBe(false);
  });

  it('shows for a recorded restore milestone', () => {
    const result = evalState({ milestoneEvents: { restore: daysAgo(1) } });
    expect(result.show).toBe(true);
    expect(result.milestoneKey).toBe('restore');
  });

  it('shows for a recorded debt-settled milestone', () => {
    const result = evalState({ milestoneEvents: { 'debt-settled': daysAgo(1) } });
    expect(result.show).toBe(true);
    expect(result.milestoneKey).toBe('debt-settled');
  });

  it('respects the 60-day cooldown after a prompt was shown', () => {
    const result = evalState({ lastPromptShownAt: daysAgo(30) }, { hasBackup: true });
    expect(result.show).toBe(false);
  });

  it('allows a new prompt after the 60-day cooldown elapses', () => {
    const result = evalState({ lastPromptShownAt: daysAgo(61) }, { hasBackup: true });
    expect(result.show).toBe(true);
  });

  it('respects the cooldown after dismissal', () => {
    const result = evalState({ lastPromptDismissedAt: daysAgo(10) }, { hasBackup: true });
    expect(result.show).toBe(false);
  });

  it('suppresses prompts for a long period after a support click', () => {
    const result = evalState({ supportClickedAt: daysAgo(100) }, { hasBackup: true });
    expect(result.show).toBe(false);
  });

  it('allows a prompt long after the click suppression window', () => {
    const result = evalState({ supportClickedAt: daysAgo(400) }, { hasBackup: true });
    expect(result.show).toBe(true);
  });

  it('does not re-prompt a milestone that already prompted', () => {
    const result = evalState(
      { promptedMilestones: ['first-backup'], lastPromptShownAt: null },
      { hasBackup: true }
    );
    expect(result.show).toBe(false);
  });

  it('respects permanent suppression', () => {
    const result = evalState({ permanentlySuppressed: true }, { hasBackup: true });
    expect(result.show).toBe(false);
  });

  it('prefers the first-backup milestone over others', () => {
    const result = evalState(
      { milestoneEvents: { restore: daysAgo(1) } },
      { hasBackup: true, firstTransactionDate: daysAgo(2).slice(0, 10) }
    );
    expect(result.milestoneKey).toBe('first-backup');
  });
});

describe('support prompt persistence', () => {
  it('records prompt shown and persists cooldown state', async () => {
    await recordSupportPromptShown('first-backup');
    const state = await getSupportPromptState();
    expect(state.lastPromptShownAt).toBeTruthy();
    expect(state.promptedMilestones).toContain('first-backup');
  });

  it('records dismissal', async () => {
    await dismissSupportPrompt();
    const state = await getSupportPromptState();
    expect(state.lastPromptDismissedAt).toBeTruthy();
  });

  it('records support click', async () => {
    await recordSupportClick();
    const state = await getSupportPromptState();
    expect(state.supportClickedAt).toBeTruthy();
  });

  it('records milestone events', async () => {
    await recordSupportMilestone('restore');
    const state = await getSupportPromptState();
    expect(state.milestoneEvents['restore']).toBeTruthy();
  });

  it('suppresses permanently', async () => {
    await suppressSupportPrompts();
    const state = await getSupportPromptState();
    expect(state.permanentlySuppressed).toBe(true);
  });

  it('handles corrupt stored state gracefully', async () => {
    await db.settings.put({ key: 'support_prompt_state', value: 'not-an-object' });
    const state = await getSupportPromptState();
    expect(state.permanentlySuppressed).toBe(false);
    expect(state.promptedMilestones).toEqual([]);
  });
});
