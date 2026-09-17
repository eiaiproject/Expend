import { describe, it, expect } from 'vitest';
import { getLiveParts, hasDigits } from '../../src/components/LiveParseFeedback';

describe('LiveParseFeedback parts (presentation only, parser untouched)', () => {
  it('parses desc + amount + source badges', () => {
    const p = getLiveParts('kopi 25rb dari BSI');
    expect(p).not.toBeNull();
    expect(p!.amount).toBe(25000);
    expect(p!.source).toBe('BSI');
    expect(p!.description.length).toBeGreaterThan(0);
  });

  it('returns null for empty or unparsable input', () => {
    expect(getLiveParts('')).toBeNull();
    expect(getLiveParts('   ')).toBeNull();
    expect(getLiveParts('Kopi 50')).toBeNull();
  });

  it('flags date badge for relative dates', () => {
    const p = getLiveParts('makan siang 30rb kemarin');
    expect(p).not.toBeNull();
    expect(p!.dateBadge).not.toBeNull();
  });

  it('hasDigits gates the actionable InlineAlert', () => {
    expect(hasDigits('Kopi 50')).toBe(true);
    expect(hasDigits('halo')).toBe(false);
  });
});
