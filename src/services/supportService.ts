/**
 * Support service (master.md section 9).
 *
 * Centralizes the Trakteer support link and the local, resettable state that
 * gates the contextual support prompt. No financial data is ever included in
 * external links and nothing is transmitted anywhere.
 *
 * Contextual prompt rules (9.4 / 9.5):
 * - Never before the first completed transaction.
 * - Eligible milestones: first successful backup (strong — bypasses the
 *   14-day meaningful-use gate), successful restore, settled debt,
 *   100 transactions, and 30 days of meaningful use.
 * - Never more than once within 60 days.
 * - If dismissed, respect a cooldown.
 * - If the support action is clicked, stop automatic prompts for a long
 *   period (365 days).
 * - Permanent support links remain available in Settings and About.
 */
import { db } from '../db/db';
import { getBackupMetadata } from './backupService';

// ── External links ────────────────────────────────────────────

/** Trakteer support URL. No app data is appended. */
export const TRAKTEER_URL = 'https://trakteer.id/eiaiproject';

/** Canonical source repository. */
export const SOURCE_CODE_URL = 'https://github.com/eiaiproject/Expend';

/** Issue reporting URL. */
export const ISSUES_URL = 'https://github.com/eiaiproject/Expend/issues';

// ── Prompt rules ──────────────────────────────────────────────

export const SUPPORT_PROMPT_COOLDOWN_DAYS = 60;
export const SUPPORT_CLICK_SUPPRESSION_DAYS = 365;
export const SUPPORT_MEANINGFUL_USE_DAYS = 14;
export const SUPPORT_LONG_USE_DAYS = 30;
export const SUPPORT_TX_MILESTONE = 100;

// ── Types ─────────────────────────────────────────────────────

export type SupportMilestoneKey =
  | 'first-backup'
  | 'restore'
  | 'debt-settled'
  | '100-tx'
  | '30-days';

export interface SupportPromptState {
  /** ISO timestamp of the last prompt shown, or null */
  lastPromptShownAt: string | null;
  /** ISO timestamp of the last prompt dismissal, or null */
  lastPromptDismissedAt: string | null;
  /** ISO timestamp when the support action was clicked, or null */
  supportClickedAt: string | null;
  /** Permanently suppress automatic prompts */
  permanentlySuppressed: boolean;
  /** Milestones that already triggered a prompt (deduplication) */
  promptedMilestones: SupportMilestoneKey[];
  /** Timestamps of milestone events recorded from app flows */
  milestoneEvents: Partial<Record<SupportMilestoneKey, string>>;
}

export interface SupportPromptEvaluation {
  show: boolean;
  milestoneKey: SupportMilestoneKey | null;
}

export interface EvaluateSupportPromptInput {
  state: SupportPromptState;
  now: Date;
  txCount: number;
  hasBackup: boolean;
  /** Earliest transaction date as YYYY-MM-DD, or null when no transactions */
  firstTransactionDate: string | null;
}

// ── Defaults ──────────────────────────────────────────────────

function defaultState(): SupportPromptState {
  return {
    lastPromptShownAt: null,
    lastPromptDismissedAt: null,
    supportClickedAt: null,
    permanentlySuppressed: false,
    promptedMilestones: [],
    milestoneEvents: {},
  };
}

// ── Settings storage ──────────────────────────────────────────

const SETTINGS_KEY = 'support_prompt_state';

/** Read the current support prompt state, tolerating corrupt values. */
export async function getSupportPromptState(): Promise<SupportPromptState> {
  try {
    const entry = await db.settings.get(SETTINGS_KEY);
    if (entry?.value && typeof entry.value === 'object') {
      return {
        ...defaultState(),
        ...(entry.value as Partial<SupportPromptState>),
        promptedMilestones: Array.isArray((entry.value as SupportPromptState).promptedMilestones)
          ? (entry.value as SupportPromptState).promptedMilestones
          : [],
        milestoneEvents: (entry.value as SupportPromptState).milestoneEvents ?? {},
      };
    }
  } catch {
    // Database unavailable — fall through to defaults
  }
  return defaultState();
}

async function saveSupportPromptState(state: SupportPromptState): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY, value: state });
}

// ── Milestone recording ───────────────────────────────────────

/**
 * Record a milestone event from an app flow (restore, debt settled).
 * These make the prompt eligible on the next evaluation.
 */
export async function recordSupportMilestone(key: 'restore' | 'debt-settled'): Promise<void> {
  const state = await getSupportPromptState();
  state.milestoneEvents[key] = new Date().toISOString();
  await saveSupportPromptState(state);
}

/**
 * Record that a prompt was shown for a milestone. Starts the 60-day cooldown
 * and prevents the same milestone from prompting again.
 */
export async function recordSupportPromptShown(milestoneKey: SupportMilestoneKey): Promise<void> {
  const state = await getSupportPromptState();
  state.lastPromptShownAt = new Date().toISOString();
  if (!state.promptedMilestones.includes(milestoneKey)) {
    state.promptedMilestones = [...state.promptedMilestones, milestoneKey];
  }
  await saveSupportPromptState(state);
}

/** Record a prompt dismissal (starts a cooldown). */
export async function dismissSupportPrompt(): Promise<void> {
  const state = await getSupportPromptState();
  state.lastPromptDismissedAt = new Date().toISOString();
  await saveSupportPromptState(state);
}

/** Record a support-action click (long suppression). */
export async function recordSupportClick(): Promise<void> {
  const state = await getSupportPromptState();
  state.supportClickedAt = new Date().toISOString();
  await saveSupportPromptState(state);
}

/** Permanently suppress automatic support prompts. */
export async function suppressSupportPrompts(): Promise<void> {
  const state = await getSupportPromptState();
  state.permanentlySuppressed = true;
  await saveSupportPromptState(state);
}

// ── Evaluation ────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function daysBetween(now: Date, then: string): number {
  const thenMs = new Date(then).getTime();
  if (Number.isNaN(thenMs)) return 0;
  return Math.max(0, Math.floor((now.getTime() - thenMs) / DAY_MS));
}

/**
 * Pure evaluation of whether the contextual support prompt should show.
 * Deterministic and unit-testable.
 */
export function evaluateSupportPrompt(input: EvaluateSupportPromptInput): SupportPromptEvaluation {
  const { state, now, txCount, hasBackup, firstTransactionDate } = input;

  // Never before the first completed transaction
  if (txCount <= 0) return { show: false, milestoneKey: null };

  // Permanent suppression
  if (state.permanentlySuppressed) return { show: false, milestoneKey: null };

  // Support action clicked → long suppression window
  if (state.supportClickedAt) {
    if (daysBetween(now, state.supportClickedAt) < SUPPORT_CLICK_SUPPRESSION_DAYS) {
      return { show: false, milestoneKey: null };
    }
  }

  // Cooldown after a prompt was shown
  if (state.lastPromptShownAt) {
    if (daysBetween(now, state.lastPromptShownAt) < SUPPORT_PROMPT_COOLDOWN_DAYS) {
      return { show: false, milestoneKey: null };
    }
  }

  // Cooldown after a dismissal
  if (state.lastPromptDismissedAt) {
    if (daysBetween(now, state.lastPromptDismissedAt) < SUPPORT_PROMPT_COOLDOWN_DAYS) {
      return { show: false, milestoneKey: null };
    }
  }

  const prompted = (key: SupportMilestoneKey) => state.promptedMilestones.includes(key);

  // Strong milestone: first successful backup bypasses the 14-day gate
  if (hasBackup && !prompted('first-backup')) {
    return { show: true, milestoneKey: 'first-backup' };
  }

  const useDays = firstTransactionDate
    ? daysBetween(now, `${firstTransactionDate}T00:00:00`)
    : 0;
  const meaningfulUse = useDays >= SUPPORT_MEANINGFUL_USE_DAYS;

  // Successful restore
  if (state.milestoneEvents['restore'] && !prompted('restore') && meaningfulUse) {
    return { show: true, milestoneKey: 'restore' };
  }

  // Settled debt
  if (state.milestoneEvents['debt-settled'] && !prompted('debt-settled') && meaningfulUse) {
    return { show: true, milestoneKey: 'debt-settled' };
  }

  // 100 transactions
  if (txCount >= SUPPORT_TX_MILESTONE && !prompted('100-tx') && meaningfulUse) {
    return { show: true, milestoneKey: '100-tx' };
  }

  // 30 days of meaningful use
  if (useDays >= SUPPORT_LONG_USE_DAYS && !prompted('30-days')) {
    return { show: true, milestoneKey: '30-days' };
  }

  return { show: false, milestoneKey: null };
}

/**
 * Evaluate the prompt using live database state.
 */
export async function evaluateSupportPromptNow(): Promise<SupportPromptEvaluation> {
  const [state, backupMeta, txCount, firstTx] = await Promise.all([
    getSupportPromptState(),
    getBackupMetadata(),
    db.transactions.count(),
    db.transactions.orderBy('date').first(),
  ]);

  return evaluateSupportPrompt({
    state,
    now: new Date(),
    txCount,
    hasBackup: backupMeta.lastBackupAt != null,
    firstTransactionDate: firstTx?.date ?? null,
  });
}
