import { describe, it, expect } from 'vitest';
import { detectInputLang } from '../../src/utils/langDetect';

describe('detectInputLang (per-input, offline heuristic)', () => {
  it('detects english-only input', () => {
    expect(detectInputLang('coffee with payment yesterday')).toBe('en');
  });

  it('detects indonesian-only input', () => {
    expect(detectInputLang('kopi bayar kemarin')).toBe('id');
  });

  it('returns null for mixed, neutral, or too-short input (conservative)', () => {
    expect(detectInputLang('kopi 25rb from BSI')).toBeNull();
    expect(detectInputLang('ok')).toBeNull();
    expect(detectInputLang('indomaret 50000')).toBeNull();
  });

  it('detects single-language keyword input', () => {
    expect(detectInputLang('kopi 25rb')).toBe('id');
  });
});
