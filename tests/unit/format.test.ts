import { describe, it, expect } from 'vitest';
import { fmtDate, fmtTime, monthLabelFor } from '../../src/utils/format';
import { isValidISODate } from '../../src/utils/date';

describe('fmtDate defensif', () => {
  it('tidak melempar untuk tanggal kosong', () => {
    expect(fmtDate('', 'id')).toBe('-');
  });

  it('mengembalikan input untuk string yang bukan tanggal', () => {
    expect(fmtDate('bukan-tanggal', 'id')).toBe('bukan-tanggal');
  });

  it('tidak menggeser tanggal kalender yang tidak ada', () => {
    expect(fmtDate('2026-02-31', 'id')).toBe('2026-02-31');
    expect(fmtDate('2026-13-01', 'id')).toBe('2026-13-01');
  });

  it('memformat tanggal valid sesuai locale', () => {
    expect(fmtDate('2026-09-02', 'id')).toContain('2026');
    expect(fmtDate('2026-09-02', 'en')).toContain('2026');
  });
});

describe('fmtTime defensif', () => {
  it('mengembalikan string kosong untuk timestamp rusak', () => {
    expect(fmtTime('bukan-waktu', 'id')).toBe('');
  });

  it('memformat timestamp valid', () => {
    expect(fmtTime('2026-09-02T10:15:00.000Z', 'id')).toMatch(/\d{2}[.:]\d{2}/);
  });
});

describe('monthLabelFor', () => {
  it('mengembalikan key untuk bulan rusak', () => {
    expect(monthLabelFor('2026-99', 'id')).toBe('2026-99');
  });
});

describe('isValidISODate', () => {
  it('menerima tanggal kalender yang valid dan menolak yang tidak ada', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });
});
