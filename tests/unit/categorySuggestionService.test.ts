/**
 * Unit tests for categorySuggestionService suggestion precedence and payee ranking.
 */
import { describe, it, expect } from 'vitest';
import type { Category, Merchant, Transaction } from '../../src/db/db';
import { suggestCategoryForPayee, rankPayees } from '../../src/services/categorySuggestionService';

function makeCategory(id: number, name: string): Category {
  return { id, name, icon: '🏷️', color: '#000000' };
}

function makeTx(description: string, categoryId: number | null, date: string): Transaction {
  return {
    id: Math.random(),
    walletId: 1,
    categoryId,
    date,
    description,
    type: 'expense',
    amount: 1000,
  };
}

function makeMerchant(displayName: string, aliases: string[] = [], originalName?: string): Merchant {
  return {
    id: Math.random(),
    displayName,
    originalName: originalName ?? displayName,
    aliases,
    archivedAt: null,
    mergedIntoId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const categories = [makeCategory(1, 'Food'), makeCategory(2, 'Transport'), makeCategory(3, 'Other')];

// ── Suggestion precedence ──────────────────────────────────────

describe('suggestCategoryForPayee', () => {
  it('returns none for an empty payee', () => {
    const result = suggestCategoryForPayee('', [], categories);
    expect(result.source).toBe('none');
    expect(result.categoryId).toBeNull();
  });

  it('matches exact normalized payee', () => {
    const txs = [makeTx('Coffee Shop', 1, '2026-01-01')];
    const result = suggestCategoryForPayee('  coffee shop  ', txs, categories);
    expect(result.source).toBe('exact');
    expect(result.categoryId).toBe(1);
    expect(result.categoryName).toBe('Food');
  });

  it('matches via merchant alias when payee differs', () => {
    const txs = [makeTx('Starbucks', 1, '2026-01-01')];
    const merchants = [makeMerchant('Starbucks', ['Starbucks Coffee'])];
    const result = suggestCategoryForPayee('Starbucks Coffee', txs, categories, merchants);
    expect(result.source).toBe('merchant');
    expect(result.categoryId).toBe(1);
  });

  it('matches similar payee names (containment)', () => {
    const txs = [makeTx('Warung Bu Tini', 1, '2026-01-01')];
    const result = suggestCategoryForPayee('warung bu tini cabang 2', txs, categories);
    expect(result.source).toBe('similar');
    expect(result.categoryId).toBe(1);
  });

  it('matches similar payee names (reverse containment)', () => {
    const txs = [makeTx('Starbucks Reserve', 1, '2026-01-01')];
    const result = suggestCategoryForPayee('Starbucks', txs, categories);
    expect(result.source).toBe('similar');
    expect(result.categoryId).toBe(1);
  });

  it('does not match short similar names (guard rail)', () => {
    const txs = [makeTx('Go', 1, '2026-01-01')];
    const result = suggestCategoryForPayee('Gofood', txs, categories);
    // "go" is too short for similar matching; falls through to default
    expect(result.source).not.toBe('similar');
  });

  it('falls back to last selected category', () => {
    const result = suggestCategoryForPayee('Unknown Place', [], categories, [], 2);
    expect(result.source).toBe('last-used');
    expect(result.categoryId).toBe(2);
  });

  it('falls back to the default category', () => {
    const result = suggestCategoryForPayee('Unknown Place', [], categories, [], null);
    expect(result.source).toBe('default');
    expect(result.categoryName).toBe('Other');
  });

  it('returns none when no default category exists', () => {
    const result = suggestCategoryForPayee('Unknown Place', [], [makeCategory(1, 'Food')], [], null);
    expect(result.source).toBe('none');
    expect(result.categoryId).toBeNull();
  });

  it('prefers exact over last-used', () => {
    const txs = [makeTx('Coffee Shop', 1, '2026-01-01')];
    const result = suggestCategoryForPayee('Coffee Shop', txs, categories, [], 2);
    expect(result.source).toBe('exact');
    expect(result.categoryId).toBe(1);
  });

  it('uses the most recent occurrence for a payee', () => {
    const txs = [
      makeTx('Coffee Shop', 1, '2026-01-01'),
      makeTx('Coffee Shop', 2, '2026-03-01'),
    ];
    const result = suggestCategoryForPayee('Coffee Shop', txs, categories);
    expect(result.categoryId).toBe(2);
  });
});

// ── Payee ranking ──────────────────────────────────────────────

describe('rankPayees', () => {
  const today = '2026-07-31';

  it('returns an empty list for no transactions', () => {
    expect(rankPayees([], new Set(), today)).toHaveLength(0);
  });

  it('ignores non-expense transactions', () => {
    const tx: Transaction = {
      id: 1,
      walletId: 1,
      categoryId: null,
      date: today,
      description: 'Transfer',
      type: 'transfer_out',
      amount: 1000,
    };
    expect(rankPayees([tx], new Set(), today)).toHaveLength(0);
  });

  it('ignores transactions older than 90 days', () => {
    const txs = [makeTx('Old Place', 1, '2025-01-01')];
    expect(rankPayees(txs, new Set(), today)).toHaveLength(0);
  });

  it('ranks higher frequency payees first', () => {
    const txs = [
      makeTx('Frequent', 1, '2026-07-01'),
      makeTx('Frequent', 1, '2026-07-02'),
      makeTx('Rare', 1, '2026-07-03'),
    ];
    const ranked = rankPayees(txs, new Set(), today);
    expect(ranked[0]?.key).toBe('frequent');
    expect(ranked[0]?.frequency).toBe(2);
  });

  it('boosts favorite payees', () => {
    const txs = [
      makeTx('Favorite', 1, '2026-07-01'),
      makeTx('Busy', 1, '2026-07-02'),
      makeTx('Busy', 1, '2026-07-03'),
    ];
    const favorites = new Set(['favorite']);
    const ranked = rankPayees(txs, favorites, today);
    // Favorite bonus of +3 should overtake the extra frequency
    expect(ranked[0]?.key).toBe('favorite');
  });

  it('applies the 7-day recency bonus over an older within-window payee', () => {
    // Both payees inside the 90-day window with equal frequency
    const txs = [
      makeTx('Recent', 1, '2026-07-30'), // within last 7 days
      makeTx('Stale', 1, '2026-06-15'), // within window but older than 7 days
    ];
    const ranked = rankPayees(txs, new Set(), today);
    expect(ranked).toHaveLength(2);
    const [recent, stale] = ranked;
    expect(recent?.key).toBe('recent');
    expect(recent?.score).toBe((stale?.score ?? 0) + 1);
  });

  it('normalizes payee keys for grouping', () => {
    const txs = [
      makeTx('Coffee Shop', 1, '2026-07-01'),
      makeTx('coffee shop', 1, '2026-07-02'),
    ];
    const ranked = rankPayees(txs, new Set(), today);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.frequency).toBe(2);
  });
});
