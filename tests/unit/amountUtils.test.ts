import { describe, it, expect } from 'vitest';
import {
  sanitizeAmountInput, formatAmountDisplay, parseAmountToNumber,
  numberToAmountInput,
} from '../../src/utils/amountUtils';

describe('sanitizeAmountInput', () => {
  it('treats the last separator with 1-2 trailing digits as decimal', () => {
    expect(sanitizeAmountInput('12.50')).toBe('12,50');
    expect(sanitizeAmountInput('25,000,50')).toBe('25000,50');
    expect(sanitizeAmountInput('25.000,50')).toBe('25000,50');
    expect(sanitizeAmountInput('abc1.2x3')).toBe('1,23');
  });
  it('treats separators as grouping otherwise (thousands)', () => {
    expect(sanitizeAmountInput('1234,567')).toBe('1234567');
    expect(sanitizeAmountInput('5.678')).toBe('5678');
    expect(sanitizeAmountInput('250000')).toBe('250000');
  });
});

describe('formatAmountDisplay', () => {
  it('groups integer part with dots', () => {
    expect(formatAmountDisplay('2500000')).toBe('2.500.000');
    expect(formatAmountDisplay('25000,5')).toBe('25.000,5');
  });
  it('leaves small values alone', () => {
    expect(formatAmountDisplay('0')).toBe('0');
    expect(formatAmountDisplay('')).toBe('');
  });
});

describe('parseAmountToNumber', () => {
  it('parses id-ID formatted amounts', () => {
    expect(parseAmountToNumber('25.000,50')).toBe(25000.5);
    expect(parseAmountToNumber('25000')).toBe(25000);
    expect(parseAmountToNumber('')).toBe(0);
    expect(parseAmountToNumber('abc')).toBe(0);
  });
});

describe('numberToAmountInput', () => {
  it('converts number to input form', () => {
    expect(numberToAmountInput(25000)).toBe('25000');
    expect(numberToAmountInput(25000.5)).toBe('25000,5');
    expect(numberToAmountInput(0.05)).toBe('0,05');
  });
});