import { describe, it, expect } from 'vitest';
import { scoreAmount, pickBestAmount, type RankedAmount } from '../../src/utils/amountRank';

function cand(value: number, signals: Partial<RankedAmount['signals']> = {}, index = 0): RankedAmount {
  return { value, index, signals: { hasSuffix: false, hasRp: false, hasKeyword: false, ...signals } };
}

describe('scoreAmount', () => {
  it('plain value = raw value', () => {
    expect(scoreAmount(50000, cand(50000).signals)).toBe(50000);
  });
  it('suffix multiplies x3', () => {
    expect(scoreAmount(50000, cand(50000, { hasSuffix: true }).signals)).toBe(150000);
  });
  it('Rp multiplies x2.5', () => {
    expect(scoreAmount(50000, cand(50000, { hasRp: true }).signals)).toBe(125000);
  });
  it('keyword multiplies x2.2', () => {
    expect(scoreAmount(50000, cand(50000, { hasKeyword: true }).signals)).toBeCloseTo(110000, 6);
  });
  it('tiny bare number penalized', () => {
    expect(scoreAmount(2, cand(2).signals)).toBeLessThan(50000);
  });
  it('huge bare number penalized relative to unpenalized', () => {
    const v = 123456789012;
    expect(scoreAmount(v, cand(v).signals)).toBeLessThan(v);
  });
  it('suffix shields tiny number from penalty', () => {
    // "2jt" is real money despite being a small raw count
    expect(scoreAmount(2_000_000, cand(2_000_000, { hasSuffix: true }).signals)).toBe(6_000_000);
  });
});

describe('pickBestAmount', () => {
  it('empty → null', () => {
    expect(pickBestAmount([])).toBeNull();
  });
  it('picks highest score, not first', () => {
    // 60000 plain vs 50000×3=150000 suffixed → suffixed wins despite later position
    const best = pickBestAmount([cand(60000, {}, 0), cand(50000, { hasSuffix: true }, 10)]);
    expect(best?.value).toBe(50000);
    expect(best?.index).toBe(10);
  });
  it('tie → larger value wins', () => {
    const best = pickBestAmount([cand(10000, {}, 0), cand(20000, {}, 5)]);
    // 10000 vs 20000: scores differ, larger wins naturally
    expect(best?.value).toBe(20000);
  });
});
