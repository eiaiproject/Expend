import { describe, it, expect } from 'vitest';
import { scoreAmount, amountTier, pickBestAmount, type RankedAmount } from '../../src/utils/amountRank';

function cand(value: number, signals: Partial<RankedAmount['signals']> = {}, index = 0): RankedAmount {
  return { value, index, signals: { hasSuffix: false, hasRp: false, hasKeyword: false, ...signals } };
}

describe('amountTier', () => {
  it('suffix/Rp → tier 3 (explicit money)', () => {
    expect(amountTier(50000, { hasSuffix: true, hasRp: false, hasKeyword: false })).toBe(3);
    expect(amountTier(50000, { hasSuffix: false, hasRp: true, hasKeyword: false })).toBe(3);
  });
  it('keyword-only → tier 2', () => {
    expect(amountTier(50000, { hasSuffix: false, hasRp: false, hasKeyword: true })).toBe(2);
  });
  it('bare plausible amount → tier 1', () => {
    expect(amountTier(50000, { hasSuffix: false, hasRp: false, hasKeyword: false })).toBe(1);
  });
  it('bare tiny (quantity/floor) → tier 0', () => {
    expect(amountTier(2, { hasSuffix: false, hasRp: false, hasKeyword: false })).toBe(0);
  });
  it('bare huge (ID/ref) → tier 0', () => {
    expect(amountTier(1_234_567_890_123, { hasSuffix: false, hasRp: false, hasKeyword: false })).toBe(0);
  });
});

describe('scoreAmount — tier dominates magnitude', () => {
  it('suffix signal beats a much larger bare number', () => {
    // 50rb (tier 3) vs bare 1.000.000 (tier 1): signal wins despite smaller value
    expect(scoreAmount(50000, cand(50000, { hasSuffix: true }).signals))
      .toBeGreaterThan(scoreAmount(1_000_000, cand(1_000_000).signals));
  });
  it('keyword signal beats a much larger bare number', () => {
    // "Total 50.000" (tier 2) vs bare 1.000.000 (tier 1)
    expect(scoreAmount(50000, cand(50000, { hasKeyword: true }).signals))
      .toBeGreaterThan(scoreAmount(1_000_000, cand(1_000_000).signals));
  });
  it('Rp signal beats a much larger bare number', () => {
    expect(scoreAmount(50000, cand(50000, { hasRp: true }).signals))
      .toBeGreaterThan(scoreAmount(1_000_000, cand(1_000_000).signals));
  });
  it('same tier → larger value wins', () => {
    expect(scoreAmount(20000, cand(20000).signals)).toBeGreaterThan(scoreAmount(10000, cand(10000).signals));
  });
  it('tiny bare loses to plausible bare', () => {
    expect(scoreAmount(100000, cand(100000).signals)).toBeGreaterThan(scoreAmount(2, cand(2).signals));
  });
  it('suffix shields small raw count from penalty (2jt)', () => {
    expect(scoreAmount(2_000_000, cand(2_000_000, { hasSuffix: true }).signals))
      .toBeGreaterThan(scoreAmount(100_000, cand(100_000).signals));
  });
});

describe('pickBestAmount', () => {
  it('empty → null', () => {
    expect(pickBestAmount([])).toBeNull();
  });
  it('signal beats larger bare value regardless of position', () => {
    // bare 600000 vs suffixed 50000 → suffixed wins despite lower value
    const best = pickBestAmount([cand(600000, {}, 0), cand(50000, { hasSuffix: true }, 10)]);
    expect(best?.value).toBe(50000);
    expect(best?.index).toBe(10);
  });
  it('same signals → larger value wins', () => {
    const best = pickBestAmount([cand(10000, {}, 0), cand(20000, {}, 5)]);
    expect(best?.value).toBe(20000);
  });
  it('equal value + same tier → first candidate wins', () => {
    const best = pickBestAmount([cand(50000, { hasSuffix: true }, 0), cand(50000, { hasSuffix: true }, 10)]);
    expect(best?.index).toBe(0);
  });
});
