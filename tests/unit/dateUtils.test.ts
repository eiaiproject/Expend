import { describe, it, expect } from 'vitest';
import {
  getTodayStr,
  getYesterdayStr,
  getWeekStartStr,
  getMonthStartStr,
  getNextMonthStartStr,
  getMonthPrefix,
  normaliseDate,
  parseDate,
  displayDateFull,
} from '@/utils/dateUtils';

describe('dateUtils', () => {
  describe('getTodayStr', () => {
    it('returns today in YYYY-MM-DD format', () => {
      const today = getTodayStr();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns specific date when provided', () => {
      const fixedDate = new Date(2024, 0, 15); // January 15, 2024
      const result = getTodayStr(fixedDate);
      expect(result).toBe('2024-01-15');
    });
  });

  describe('getYesterdayStr', () => {
    it('returns yesterday in YYYY-MM-DD format', () => {
      const yesterday = getYesterdayStr();
      expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns correct yesterday date', () => {
      const fixedDate = new Date(2024, 0, 15); // January 15, 2024
      const result = getYesterdayStr(fixedDate);
      expect(result).toBe('2024-01-14');
    });
  });

  describe('getWeekStartStr', () => {
    it('returns Monday of current week', () => {
      const fixedDate = new Date(2024, 0, 17); // Wednesday, January 17, 2024
      const result = getWeekStartStr(fixedDate);
      expect(result).toBe('2024-01-15'); // Monday
    });
  });

  describe('getMonthStartStr', () => {
    it('returns first day of current month', () => {
      const fixedDate = new Date(2024, 0, 15);
      const result = getMonthStartStr(fixedDate);
      expect(result).toBe('2024-01-01');
    });
  });

  describe('getNextMonthStartStr', () => {
    it('returns first day of next month', () => {
      const fixedDate = new Date(2024, 0, 15);
      const result = getNextMonthStartStr(fixedDate);
      expect(result).toBe('2024-02-01');
    });

    it('handles year boundary', () => {
      const fixedDate = new Date(2024, 11, 15); // December
      const result = getNextMonthStartStr(fixedDate);
      expect(result).toBe('2025-01-01');
    });
  });

  describe('getMonthPrefix', () => {
    it('extracts YYYY-MM prefix', () => {
      expect(getMonthPrefix('2024-01-15')).toBe('2024-01');
    });

    it('handles full ISO date', () => {
      expect(getMonthPrefix('2024-12-31T10:30:00.000Z')).toBe('2024-12');
    });
  });

  describe('normaliseDate', () => {
    it('strips time portion from ISO date', () => {
      expect(normaliseDate('2024-01-15T10:30:00.000Z')).toBe('2024-01-15');
    });

    it('returns date-only string unchanged', () => {
      expect(normaliseDate('2024-01-15')).toBe('2024-01-15');
    });
  });

  describe('parseDate', () => {
    it('parses date string to Date object at noon UTC', () => {
      const date = parseDate('2024-01-15');
      expect(date).toBeInstanceOf(Date);
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0); // January is 0
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(12); // Noon UTC
    });
  });

  describe('displayDateFull', () => {
    it('formats date in English', () => {
      const result = displayDateFull('2024-01-15', 'en');
      expect(result).toBe('15 January 2024');
    });

    it('formats date in Indonesian', () => {
      const result = displayDateFull('2024-01-15', 'id');
      expect(result).toBe('15 Januari 2024');
    });

    it('defaults to English when no locale provided', () => {
      const result = displayDateFull('2024-01-15');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });
  });
});
