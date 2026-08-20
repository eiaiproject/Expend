import { describe, it, expect } from 'vitest';
import { parseAmountToken, parseRecordingText, parseBatchLines } from '../../src/services/naturalTextParser';

describe('parseAmountToken', () => {
  it('parses id-ID amounts with and without prefix', () => {
    expect(parseAmountToken('Rp 25.000')).toBe(25000);
    expect(parseAmountToken('Total: 25.000,50')).toBe(25000.5);
    expect(parseAmountToken('no numbers here')).toBeNull();
  });
});

describe('parseRecordingText', () => {
  it('extracts amount and keeps rest of line as description', () => {
    expect(parseRecordingText('Gojek 25.000')).toEqual({ description: 'Gojek', amount: '25000' });
  });
  it('returns description-only when no amount', () => {
    expect(parseRecordingText('Nasi Padang')).toEqual({ description: 'Nasi Padang', amount: '' });
  });
});

describe('parseBatchLines', () => {
  it('parses multiline payee-amount pairs, ignoring non-amount lines', () => {
    const text = 'Nasi Padang 25000\nBakso 15000\n\nskip me';
    expect(parseBatchLines(text)).toEqual([
      { description: 'Nasi Padang', amount: '25000' },
      { description: 'Bakso', amount: '15000' },
    ]);
  });
});