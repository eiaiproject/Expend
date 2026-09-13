import { describe, it, expect, beforeEach } from 'vitest';
import { logPerf, readPerf } from '../../src/utils/perf';

beforeEach(() => localStorage.clear());

describe('perf log (local-only)', () => {
  it('appends entries newest-last', () => {
    logPerf('startup', 123, '2026-09-13T00:00:00.000Z');
    expect(readPerf()).toEqual([{ name: 'startup', ms: 123, at: '2026-09-13T00:00:00.000Z' }]);
  });

  it('caps at 50 entries', () => {
    for (let i = 0; i < 60; i++) logPerf('x', i, '2026-09-13T00:00:00.000Z');
    expect(readPerf()).toHaveLength(50);
    expect(readPerf()[49]!.ms).toBe(59);
  });

  it('corrupt payload reads as empty, never throws', () => {
    localStorage.setItem('expend_perf', '((((');
    expect(readPerf()).toEqual([]);
  });
});
