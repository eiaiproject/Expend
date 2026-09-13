import { describe, it, expect } from 'vitest';
import { isBackupDue, daysSince } from '../../src/utils/backup';

const NOW = Date.parse('2026-09-13T00:00:00.000Z');

describe('backup reminder', () => {
  it('never backed up with data → due', () => {
    expect(isBackupDue(5, null, NOW)).toBe(true);
  });

  it('empty wallet → never due', () => {
    expect(isBackupDue(0, null, NOW)).toBe(false);
  });

  it('recent backup → not due; 30+ days → due', () => {
    expect(isBackupDue(5, '2026-09-01T00:00:00.000Z', NOW)).toBe(false);
    expect(isBackupDue(5, '2026-08-13T00:00:00.000Z', NOW)).toBe(true);
  });

  it('corrupt timestamp → treated as never backed up', () => {
    expect(daysSince('bukan-tanggal', NOW)).toBeNull();
    expect(isBackupDue(5, 'bukan-tanggal', NOW)).toBe(true);
  });
});
