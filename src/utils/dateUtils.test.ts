import { describe, it, expect } from 'vitest';
import {
  parseDate,
  displayDateFull,
  getTodayStr,
  getYesterdayStr,
  getWeekStartStr,
  getMonthStartStr,
  getNextMonthStartStr,
  getMonthPrefix,
  normaliseDate,
} from './dateUtils';

describe('dateUtils', () => {
  describe('parseDate', () => {
    it('parses YYYY-MM-DD format correctly', () => {
      const date = parseDate('2024-01-15');
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(12);
    });

    it('normalizes date with time component', () => {
      const date = parseDate('2024-01-15T10:30:00.000Z');
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(15);
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
  });

  describe('getTodayStr', () => {
    it('returns today as YYYY-MM-DD', () => {
      const today = getTodayStr();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(today).toBe(expected);
    });

    it('uses fixed date for testing', () => {
      const fixedDate = new Date(2024, 0, 15);
      const result = getTodayStr(fixedDate);
      expect(result).toBe('2024-01-15');
    });
  });

  describe('getYesterdayStr', () => {
    it('returns yesterday as YYYY-MM-DD', () => {
      const yesterday = getYesterdayStr();
      const now = new Date();
      now.setDate(now.getDate() - 1);
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(yesterday).toBe(expected);
    });

    it('handles month boundary correctly', () => {
      const janFirst = new Date(2024, 0, 1);
      const result = getYesterdayStr(janFirst);
      expect(result).toBe('2023-12-31');
    });
  });

  describe('getWeekStartStr', () => {
    it('returns Monday as week start', () => {
      const wednesday = new Date(2024, 0, 17);
      const result = getWeekStartStr(wednesday);
      expect(result).toBe('2024-01-15');
    });

    it('handles Sunday correctly', () => {
      const sunday = new Date(2024, 0, 14);
      const result = getWeekStartStr(sunday);
      expect(result).toBe('2024-01-08');
    });
  });

  describe('getMonthStartStr', () => {
    it('returns first day of current month', () => {
      const result = getMonthStartStr();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      expect(result).toBe(expected);
    });
  });

  describe('getNextMonthStartStr', () => {
    it('returns first day of next month', () => {
      const date = new Date(2024, 0, 15);
      const result = getNextMonthStartStr(date);
      expect(result).toBe('2024-02-01');
    });

    it('handles December correctly', () => {
      const december = new Date(2024, 11, 15);
      const result = getNextMonthStartStr(december);
      expect(result).toBe('2025-01-01');
    });
  });

  describe('getMonthPrefix', () => {
    it('extracts YYYY-MM prefix', () => {
      expect(getMonthPrefix('2024-01-15')).toBe('2024-01');
      expect(getMonthPrefix('2024-12-31')).toBe('2024-12');
    });
  });

  describe('normaliseDate', () => {
    it('returns YYYY-MM-DD unchanged', () => {
      expect(normaliseDate('2024-01-15')).toBe('2024-01-15');
    });

    it('strips time component', () => {
      expect(normaliseDate('2024-01-15T10:30:00.000Z')).toBe('2024-01-15');
      expect(normaliseDate('2024-01-15T10:30:00')).toBe('2024-01-15');
    });
  });
});
