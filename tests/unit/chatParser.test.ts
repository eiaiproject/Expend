import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseChatInput, extractChatDate, normalizeNumber } from '../../src/utils/chatParser';

// ─── normalizeNumber ──────────────────────────────────────────────────────────

describe('normalizeNumber', () => {
  it('plain integer', () => {
    expect(normalizeNumber('50000')).toBe(50000);
  });
  it('dot as thousand separator', () => {
    expect(normalizeNumber('15.000')).toBe(15000);
  });
  it('decimal with dot: 15.5', () => {
    expect(normalizeNumber('15.5')).toBe(15.5);
  });
  it('decimal with dot (2 digits)', () => {
    expect(normalizeNumber('15.50')).toBe(15.5);
  });
  it('comma as decimal', () => {
    expect(normalizeNumber('15,50')).toBe(15.5);
  });
  it('indonesian format with dots', () => {
    expect(normalizeNumber('1.500.000')).toBe(1500000);
  });
  it('indonesian format with comma decimal', () => {
    expect(normalizeNumber('1.500.000,50')).toBe(1500000.5);
  });
  it('single digit', () => {
    expect(normalizeNumber('5')).toBe(5);
  });
  it('zero', () => {
    expect(normalizeNumber('0')).toBe(0);
  });
  it('empty string', () => {
    expect(normalizeNumber('')).toBe(0);
  });
});

// ─── Smart amount extraction ──────────────────────────────────────────────────

describe('parseChatInput - smart amount extraction', () => {
  it('basic: kopi 50rb', () => {
    const r = parseChatInput('kopi 50rb');
    expect(r?.amount).toBe(50000);
  });
  it('suffix jt', () => {
    expect(parseChatInput('laptop 1,5jt')?.amount).toBe(1_500_000);
  });
  it('suffix juta', () => {
    expect(parseChatInput('sewa 2 juta')?.amount).toBe(2_000_000);
  });
  it('suffix ribu', () => {
    expect(parseChatInput('parkir 5 ribu')?.amount).toBe(5000);
  });
  it('plain number', () => {
    expect(parseChatInput('50000 indomaret')?.amount).toBe(50000);
  });
  it('dotted number', () => {
    expect(parseChatInput('belanja 50.000')?.amount).toBe(50000);
  });
  it('trailing number after preposition is NOT the amount', () => {
    // "Bayar parkir 5000 di lantai 2" → amount should be 5000, not 2
    const r = parseChatInput('bayar parkir 5000 di lantai 2');
    expect(r?.amount).toBe(5000);
  });
  it('trailing small number ignored', () => {
    // "makan di lantai 3" → "3" is too small without suffix
    const r = parseChatInput('makan 25000 di lantai 3');
    expect(r?.amount).toBe(25000);
  });
  it('two amounts: pick larger with suffix', () => {
    // "beli 2 dus kopi 50rb" → 50000 (has suffix, higher score)
    const r = parseChatInput('beli 2 dus kopi 50rb');
    expect(r?.amount).toBe(50000);
  });
  it('two amounts: pick larger plain number', () => {
    const r = parseChatInput('bayar 150000 tagihan 50000');
    expect(r?.amount).toBe(150000);
  });
  it('equal amounts: description split at winner index', () => {
    // "bayar 50rb, kembali 50rb" → both 50000; winner is first occurrence,
    // remainder (loser text) stays in description for user confirmation
    const r = parseChatInput('bayar 50rb, kembali 50rb');
    expect(r?.amount).toBe(50000);
    expect(r?.description).toContain('Kembali');
  });
  it('Rp prefix boosts score', () => {
    const r = parseChatInput('beli kopi Rp 25.000');
    expect(r?.amount).toBe(25000);
  });
  it('no amount → null', () => {
    expect(parseChatInput('halo bang')).toBeNull();
  });
  it('empty → null', () => {
    expect(parseChatInput('')).toBeNull();
  });
});

// ─── Description formatting ───────────────────────────────────────────────────

describe('parseChatInput - description', () => {
  it('strips verb prefix', () => {
    expect(parseChatInput('beli kopi 50rb')?.description).toBe('Kopi');
  });
  it('strips preposition di', () => {
    expect(parseChatInput('beli kopi di Indomaret 50000')?.description).toBe('Kopi Indomaret');
  });
  it.each([
    ['transfer BCA 100rb', 'BCA'],
    ['bayar PLN listrik 200rb', 'PLN Listrik'],
    ['beli QRIS 50rb', 'QRIS'],
  ])('preserves acronym %s', (input, expected) => {
    expect(parseChatInput(input)?.description).toBe(expected);
  });
  it('title case normal words', () => {
    expect(parseChatInput('kopi susu 25rb')?.description).toBe('Kopi Susu');
  });
  it('fallback Pengeluaran', () => {
    expect(parseChatInput('50000')?.description).toBe('Pengeluaran');
  });
  it('strips source clause from description', () => {
    expect(parseChatInput('kopi 20000 dari kas')?.description).toBe('Kopi');
  });
});

// ─── Source extraction ────────────────────────────────────────────────────────

describe('parseChatInput - source', () => {
  it.each([
    ['KPR 7500000 dari BSI', 'BSI'],
    ['makan siang 50rb via GoPay', 'GoPay'],
    ['bayar listrik 200rb pakai Dana', 'Dana'],
    ['kopi 20000 dari kas', 'Kas'],
    ['bayar tunai 50rb', 'Tunai'],
    ['kopi 25rb tunai', 'Tunai'],
    ['makan tunai 50rb', 'Tunai'],
  ])('source %s', (input, expected) => {
    const r = parseChatInput(input);
    expect(r?.source).toBe(expected);
  });
  it('no source', () => {
    expect(parseChatInput('kopi 50rb')?.source).toBeUndefined();
  });
});

// ─── Date parsing ─────────────────────────────────────────────────────────────

describe('extractChatDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['kemarin', 'bayar kopi kemarin', '2026-09-14', 'extract'],
    ['lusa', 'bayar kopi lusa', '2026-09-17', 'extract'],
    ['hari ini', 'bayar kopi hari ini', '2026-09-15', 'extract'],
    ['tgl 15', 'bayar kopi tgl 15', '2026-09-15', 'parse'],
  ] as const)('%s', (_, input, expected, mode) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T10:00:00'));
    const result = mode === 'parse' ? parseChatInput(input)?.date : extractChatDate(input);
    expect(result).toBe(expected);
  });
  it('15/08/2026', () => {
    expect(extractChatDate('bayar kopi 15/08/2026')).toBe('2026-08-15');
  });
  it('15-08-2026', () => {
    expect(extractChatDate('bayar kopi 15-08-2026')).toBe('2026-08-15');
  });
  it('15 Agustus 2026', () => {
    expect(extractChatDate('bayar kopi 15 Agustus 2026')).toBe('2026-08-15');
  });
  it('default to today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T10:00:00'));
    expect(extractChatDate('bayar kopi')).toBe('2026-09-15');
  });
});

// ─── Integration with parseChatInput ──────────────────────────────────────────

describe('parseChatInput - integration', () => {
  it('full: beli kopi di Indomaret 50000', () => {
    expect(parseChatInput('beli kopi di Indomaret 50000')).toEqual({
      description: 'Kopi Indomaret',
      amount: 50000,
      source: undefined,
      date: expect.any(String),
    });
  });
  it('full: KPR 7500000 dari BSI', () => {
    const r = parseChatInput('KPR 7500000 dari BSI');
    expect(r).toEqual({
      description: 'KPR',
      amount: 7500000,
      source: 'BSI',
      date: expect.any(String),
    });
  });
  it('full: bayar parkir 5000 di lantai 2', () => {
    const r = parseChatInput('bayar parkir 5000 di lantai 2');
    expect(r?.amount).toBe(5000);
    expect(r?.description).toBe('Parkir');
  });
});
