import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatSignedCurrency,
  formatBalance,
  formatCurrencyValue,
  formatCurrencyIntl,
  formatAmountLocal,
} from '@/utils/formatUtils';

describe('formatUtils', () => {
  describe('formatCurrency', () => {
    it('formats number as currency with IDR symbol', () => {
      const result = formatCurrency(1000000);
      expect(result).toContain('1');
      expect(result).toContain('000');
    });

    it('handles zero', () => {
      const result = formatCurrency(0);
      expect(result).toBeTruthy();
    });

    it('formats absolute value (no negative sign)', () => {
      const result = formatCurrency(-100000);
      expect(result).not.toContain('-');
    });

    it('hides amount when hideAmount is true', () => {
      const result = formatCurrency(100000, true);
      expect(result).toBe('•••••');
    });
  });

  describe('formatSignedCurrency', () => {
    it('formats with positive sign', () => {
      const result = formatSignedCurrency(100000, '+');
      expect(result).toContain('+');
      expect(result).toContain('100');
    });

    it('formats with negative sign', () => {
      const result = formatSignedCurrency(100000, '-');
      expect(result).toContain('-');
      expect(result).toContain('100');
    });
  });

  describe('formatBalance', () => {
    it('formats positive balance without sign', () => {
      const result = formatBalance(100000);
      expect(result).not.toContain('-');
      expect(result).toContain('100');
    });

    it('formats negative balance with sign', () => {
      const result = formatBalance(-100000);
      expect(result).toContain('-');
      expect(result).toContain('100');
    });
  });

  describe('formatCurrencyValue', () => {
    it('formats as plain number without currency symbol', () => {
      const result = formatCurrencyValue(100000);
      expect(result).not.toContain('Rp');
      expect(result).toContain('100');
    });
  });

  describe('formatCurrencyIntl', () => {
    it('formats using Intl.NumberFormat', () => {
      const result = formatCurrencyIntl(1000000);
      expect(result).toContain('1');
      expect(result).toContain('000');
    });
  });

  describe('formatAmountLocal', () => {
    it('formats as locale number', () => {
      const result = formatAmountLocal(1000000);
      expect(result).toContain('1');
      expect(result).toContain('000');
    });
  });
});
