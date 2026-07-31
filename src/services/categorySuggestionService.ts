/**
 * Local category suggestion service.
 *
 * Suggestion precedence (from master.md section 5.3):
 * 1. Exact normalized payee match
 * 2. Stored payee alias or merge mapping
 * 3. Similar recent description, if a safe existing mechanism exists
 * 4. Last category used for the selected payee
 * 5. Last selected category
 * 6. General default category
 *
 * Suggestions must remain visibly editable and must never silently
 * override a category the user selected manually.
 */
import type { Category, Merchant, Transaction } from '../db/db';
import { normalizePayeeKey, normalizePayeeName } from './payeeService';

export interface CategorySuggestion {
  /** Resolved category id, or null when no match exists */
  categoryId: number | null;
  /** Category display name for the suggestion, or null */
  categoryName: string | null;
  /** How confident the match is (for possible UI badge use) */
  source: 'exact' | 'merchant' | 'similar' | 'payee-history' | 'last-used' | 'default' | 'none';
}

const DEFAULT_CATEGORY_NAME = 'Other';

/**
 * Build a lookup map from normalized payee key -> { categoryId, categoryName }.
 */
function buildPayeeCategoryMap(
  transactions: readonly Transaction[],
  categories: readonly Category[],
): Map<string, { categoryId: number; categoryName: string; lastDate: string }> {
  const map = new Map<string, { categoryId: number; categoryName: string; lastDate: string }>();
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.categoryId == null) continue;
    const key = normalizePayeeKey(tx.description);
    if (!key) continue;

    const categoryName = categoryNameById.get(tx.categoryId);
    if (!categoryName) continue;

    const existing = map.get(key);
    // Prefer the most recent occurrence
    if (!existing || (tx.date ?? '') > existing.lastDate) {
      map.set(key, { categoryId: tx.categoryId, categoryName, lastDate: tx.date ?? '' });
    }
  }
  return map;
}

/**
 * Check whether a merchant resolves to the given normalized payee key.
 * Covers displayName, originalName, and aliases. Note: mergedIntoId targets
 * are not followed here — suggestion only uses the merchant's own names.
 */
function merchantMatchesPayee(merchant: Merchant, payeeKey: string): boolean {
  if (normalizePayeeKey(merchant.displayName) === payeeKey) return true;
  if (normalizePayeeKey(merchant.originalName) === payeeKey) return true;
  return merchant.aliases.some((a) => normalizePayeeKey(a) === payeeKey);
}

/**
 * Resolve a category suggestion for a payee description.
 *
 * Pure function (no DB access) for deterministic, unit-testable behavior.
 *
 * @returns A suggestion with categoryId (nullable) and the match source.
 */
export function suggestCategoryForPayee(
  payee: string,
  transactions: readonly Transaction[],
  categories: readonly Category[],
  merchants: readonly Merchant[] = [],
  lastSelectedCategoryId?: number | null,
): CategorySuggestion {
  const payeeName = normalizePayeeName(payee);
  const payeeKey = normalizePayeeKey(payeeName);
  if (!payeeKey) {
    return {
      categoryId: null,
      categoryName: null,
      source: 'none',
    };
  }

  // 1. Exact normalized payee match from transaction history
  const payeeCategoryMap = buildPayeeCategoryMap(transactions, categories);
  const exactMatch = payeeCategoryMap.get(payeeKey);
  if (exactMatch) {
    return {
      categoryId: exactMatch.categoryId,
      categoryName: exactMatch.categoryName,
      source: 'exact',
    };
  }

  // 2. Merchant alias / merge mapping
  const matchingMerchant = merchants.find((m) => merchantMatchesPayee(m, payeeKey));
  if (matchingMerchant) {
    // Merchant displayName may map to a different payee key in history
    const merchantKey = normalizePayeeKey(matchingMerchant.displayName);
    const merchantMatch = payeeCategoryMap.get(merchantKey);
    if (merchantMatch) {
      return {
        categoryId: merchantMatch.categoryId,
        categoryName: merchantMatch.categoryName,
        source: 'merchant',
      };
    }
  }

  // 4. Last category used for a similar payee (normalized prefix contains the payee)
  //    Falls back to exact key containment. Both keys must be >= 3 chars to
  //    avoid false positives on short names (e.g. "Go" matching "Gofood").
  let similarMatch: { categoryId: number; categoryName: string } | null = null;
  for (const [key, value] of payeeCategoryMap.entries()) {
    if (
      key !== payeeKey &&
      key.length >= 3 &&
      payeeKey.length >= 3 &&
      (key.includes(payeeKey) || payeeKey.includes(key))
    ) {
      similarMatch = value;
      break;
    }
  }
  if (similarMatch) {
    return {
      categoryId: similarMatch.categoryId,
      categoryName: similarMatch.categoryName,
      source: 'similar',
    };
  }

  // 5. Last selected category (user-level preference, kept by the form)
  if (lastSelectedCategoryId != null) {
    const lastCat = categories.find((c) => c.id === lastSelectedCategoryId);
    if (lastCat) {
      return {
        categoryId: lastCat.id ?? null,
        categoryName: lastCat.name,
        source: 'last-used',
      };
    }
  }

  // 6. General default category ("Other")
  const fallback = categories.find((c) => c.name === DEFAULT_CATEGORY_NAME);
  if (fallback?.id != null) {
    return {
      categoryId: fallback.id,
      categoryName: fallback.name,
      source: 'default',
    };
  }

  return {
    categoryId: null,
    categoryName: null,
    source: 'none',
  };
}

/**
 * Rank payees for the "Frequently used" section (from master.md section 6.2).
 *
 * Score = frequency within last 90 days, plus recency bonus for use within
 * the last 7 days, plus favorite bonus. Excludes archived/invalid payees.
 *
 * Pure function for deterministic, unit-testable ranking.
 */
export interface PayeeRankingItem {
  /** Normalized key used for grouping */
  key: string;
  /** Display name (most recent casing seen) */
  name: string;
  /** Transaction count within the 90-day window */
  frequency: number;
  /** Ranking score */
  score: number;
  /** Whether the payee is favorited */
  favorite: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface PayeeStat {
  count: number;
  name: string;
  lastTime: number;
}

/** Accumulate per-payee transaction counts and last-use times within the window. */
function accumulatePayeeStats(
  transactions: readonly Transaction[],
  windowStartMs: number,
): Map<string, PayeeStat> {
  const stats = new Map<string, PayeeStat>();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const key = normalizePayeeKey(tx.description);
    if (!key) continue;

    const txTime = new Date(`${tx.date}T00:00:00`).getTime();
    if (Number.isNaN(txTime) || txTime < windowStartMs) continue;

    const entry = stats.get(key);
    if (entry) {
      entry.count += 1;
      if (txTime > entry.lastTime) entry.lastTime = txTime;
    } else {
      stats.set(key, { count: 1, name: normalizePayeeName(tx.description), lastTime: txTime });
    }
  }

  return stats;
}

/** Score each payee (frequency + recency bonus + favorite bonus) and sort by score. */
function rankAccumulatedStats(
  stats: Map<string, PayeeStat>,
  favorites: ReadonlySet<string>,
  recencyStartMs: number,
): PayeeRankingItem[] {
  const results: PayeeRankingItem[] = [];
  for (const [key, stat] of stats.entries()) {
    const favorite = favorites.has(key);
    // Recency bonus for a use within the last 7 days
    const hasRecency = stat.lastTime >= recencyStartMs;
    const score = stat.count * 2 + (hasRecency ? 1 : 0) + (favorite ? 3 : 0);
    results.push({ key, name: stat.name, frequency: stat.count, score, favorite });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

export function rankPayees(
  transactions: readonly Transaction[],
  favorites: ReadonlySet<string> = new Set(),
  today: string = new Date().toISOString().slice(0, 10),
): PayeeRankingItem[] {
  const todayMs = new Date(`${today}T00:00:00`).getTime();
  const windowStartMs = todayMs - 90 * DAY_MS;
  const recencyStartMs = todayMs - 7 * DAY_MS;

  const stats = accumulatePayeeStats(transactions, windowStartMs);
  return rankAccumulatedStats(stats, favorites, recencyStartMs);
}
