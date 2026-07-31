import { describe, it, expect } from 'vitest';
import { normalizeAutoLockTimeout, AUTO_LOCK_TIMEOUT_OPTIONS } from '@/utils/constants';

describe('normalizeAutoLockTimeout (master.md 8.5 migration)', () => {
  it('keeps the four simplified options unchanged', () => {
    for (const { value } of AUTO_LOCK_TIMEOUT_OPTIONS) {
      expect(normalizeAutoLockTimeout(value)).toBe(value);
    }
  });

  it('maps legacy 1 and 2 minute values to 5 minutes', () => {
    expect(normalizeAutoLockTimeout(60_000)).toBe(300_000);
    expect(normalizeAutoLockTimeout(120_000)).toBe(300_000);
  });

  it('maps legacy 15 minutes to 30 minutes', () => {
    expect(normalizeAutoLockTimeout(900_000)).toBe(1_800_000);
  });

  it('falls back to 5 minutes for unknown values and missing settings', () => {
    expect(normalizeAutoLockTimeout(42)).toBe(300_000);
    expect(normalizeAutoLockTimeout(null)).toBe(300_000);
    expect(normalizeAutoLockTimeout(undefined)).toBe(300_000);
  });

  it('exposes exactly the four required options', () => {
    expect(AUTO_LOCK_TIMEOUT_OPTIONS.map((o) => o.value)).toEqual([1, 300_000, 1_800_000, 0]);
  });
});
