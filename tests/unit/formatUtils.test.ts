import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatBalance,
  formatCurrencyValue,
  formatTransactionAmount,
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
  describe('formatTransactionAmount (QA M1)', () => {
    const NBSP = '\u00A0';
    const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

    it('expense selalu minus walau amount positif', () => {
      expect(formatTransactionAmount('expense', 25000)).toBe(`-${fmt(25000)}`);
    });
    it('transfer_out minus / transfer_in plus', () => {
      expect(formatTransactionAmount('transfer_out', 150000)).toBe(`-${fmt(150000)}`);
      expect(formatTransactionAmount('transfer_in', 150000)).toBe(`+${fmt(150000)}`);
    });
    it('balance_adjustment mengikuti tanda nilai', () => {
      expect(formatTransactionAmount('balance_adjustment', 500000)).toBe(`+${fmt(500000)}`);
      expect(formatTransactionAmount('balance_adjustment', -50000)).toBe(`-${fmt(50000)}`);
    });
    it('hideAmount menyamarkan', () => {
      expect(formatTransactionAmount('expense', 25000, true)).toBe('\u2022\u2022\u2022\u2022\u2022');
    });
  });
});
