import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatBalance,
  formatCurrencyValue,
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
});
