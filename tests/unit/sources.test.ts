import { describe, it, expect, beforeEach } from 'vitest';
import { detectSource, detectKnownSource, registerCustomSource, clearCustomSources } from '../../src/utils/sources';

beforeEach(() => clearCustomSources());

describe('custom source registry', () => {
  it('detects a registered local bank', () => {
    registerCustomSource({ name: 'Bank Lokal Kita', patterns: [/bank\s*lokal\s*kita/i] });
    expect(detectSource('Transfer dari Bank Lokal Kita')).toBe('Bank Lokal Kita');
    expect(detectKnownSource('via Bank Lokal Kita')).toBe('Bank Lokal Kita');
  });

  it('custom entries win over built-ins with the same name', () => {
    registerCustomSource({ name: 'BCA', patterns: [/bca\s*digital\s*baru/i] });
    expect(detectSource('BCA Digital Baru')).toBe('BCA');
  });

  it('clearCustomSources restores built-in-only behavior', () => {
    registerCustomSource({ name: 'Bank Lokal Kita', patterns: [/bank\s*lokal\s*kita/i] });
    clearCustomSources();
    expect(detectKnownSource('via Bank Lokal Kita')).toBeUndefined();
  });
});
