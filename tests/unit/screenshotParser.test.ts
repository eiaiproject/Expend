import { describe, it, expect } from 'vitest';
import { parseScreenshotText } from '../../src/services/screenshotParser';

describe('parseScreenshotText', () => {
  it('extracts total amount and merchant line', () => {
    const text = [
      'GoPay Payment Successful',
      'Sate Khas Senayan',
      'Total Pembayaran',
      'Rp 75.000,00',
      '12/08/2026 14:32',
    ].join('\n');
    expect(parseScreenshotText(text)).toEqual({
      description: 'Sate Khas Senayan',
      amount: '75000,00',
      date: '2026-08-12',
    });
  });

  it('falls back to the largest amount when no total keyword', () => {
    const text = 'Transfer masuk\nRp 150.000\nBCA';
    expect(parseScreenshotText(text).amount).toBe('150000');
  });

  it('returns empty amount for text without numbers', () => {
    expect(parseScreenshotText('nothing here')).toMatchObject({ amount: '', description: 'nothing here' });
  });
});