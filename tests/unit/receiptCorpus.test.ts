import { describe, it, expect } from 'vitest';
import { parseReceiptText } from '../../src/utils/receiptParser';
import {
  AMOUNT_LABELS,
  AMOUNT_NOTATION,
  NON_AMOUNT_COMPONENTS,
  DATES,
  DESCRIPTION,
  SOURCES,
  NOTES,
  EDGE,
  RECEIPT_RESOLVED_FINDINGS,
  type ReceiptCase,
} from '../fixtures/receipt-corpus';

const MAX_AMOUNT = 1_000_000_000_000;
const MAX_DESC = 80;
const MAX_NOTE = 80;
const MAX_SOURCE = 80;
const MAX_RAW = 4000;

const GROUPS: Record<string, ReceiptCase[]> = {
  'amount-labels': AMOUNT_LABELS,
  'amount-notation': AMOUNT_NOTATION,
  'non-amount-components': NON_AMOUNT_COMPONENTS,
  dates: DATES,
  description: DESCRIPTION,
  sources: SOURCES,
  notes: NOTES,
};

type Parsed = ReturnType<typeof parseReceiptText>;

function assertReceiptInvariants(r: Parsed): void {
  if (!r) return;
  expect(Number.isFinite(r.amount)).toBe(true);
  expect(r.amount).toBeGreaterThan(0);
  expect(r.description.length).toBeGreaterThan(0);
  expect(r.description.length).toBeLessThanOrEqual(MAX_DESC);
  expect(typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)).toBe(true);
  expect(r.rawText.length).toBeLessThanOrEqual(MAX_RAW);
  if (r.note !== undefined) expect(r.note.length).toBeLessThanOrEqual(MAX_NOTE);
  if (r.source !== undefined) expect(r.source.length).toBeLessThanOrEqual(MAX_SOURCE);
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

for (const [group, cases] of Object.entries(GROUPS)) {
  describe(`receipt-corpus/${group}`, () => {
    it.each(cases.map((c) => [c.text.slice(0, 40), c] as const))('%s', (_label, c) => {
      const r = parseReceiptText(c.text);
      assertReceiptInvariants(r);
      const e = c.expect;
      if (!e) return;
      if (e.nullResult) {
        expect(r).toBeNull();
        return;
      }
      expect(r).not.toBeNull();
      if (!r) return;
      if (e.amount !== undefined) expect(r.amount).toBe(e.amount);
      if (e.description !== undefined) expect(r.description).toBe(e.description);
      if (e.date !== undefined) expect(r.date).toBe(e.date);
      if (e.note !== undefined) expect(r.note).toBe(e.note);
      // `source: undefined` adalah asersi nyata (= harus tidak ada sumber).
      if (has(e, 'source')) expect(r.source).toBe(e.source);
      expect(r.amount).toBeLessThanOrEqual(MAX_AMOUNT);
    });
  });
}

describe('receipt-corpus/edge', () => {
  it('tidak pernah throw dan tetap menghormati batas', () => {
    for (const text of EDGE) assertReceiptInvariants(parseReceiptText(text));
  });

  it('input kosong / tanpa angka tidak menghasilkan transaksi', () => {
    expect(parseReceiptText('')).toBeNull();
    expect(parseReceiptText('   ')).toBeNull();
    expect(parseReceiptText('Transfer Berhasil Tanpa Nominal')).toBeNull();
  });

  it('bebas ReDoS: input 50k karakter selesai jauh di bawah 100ms', () => {
    const text = ('Ref 1234567890\nTotal Rp 50.000\n' + 'a b '.repeat(600)).repeat(20);
    const t0 = performance.now();
    parseReceiptText(text);
    const ms = performance.now() - t0;
    console.log(`[receipt-corpus] 50k chars: ${ms.toFixed(2)}ms`);
    expect(ms).toBeLessThan(100);
  });

  it('fuzz: kombinasi token acak tidak pernah throw', () => {
    const TOKENS = [
      'Total', 'Rp', '50.000', '1O.000', 'Tunai', 'Kembalian', 'Saldo', 'Tanggal',
      '15/08/2026', 'Ref', '1234567890', 'Nama', 'Budi', 'Bank', 'Mandiri', 'Subtotal',
      'Diskon', 'PPN', 'Pulang', 'Berita', 'Catatan', 'Transaksi', '', '.', '-', 'Rp0',
      '9999999999999999', '(', '..', 'eo', 'Nominal', 'Penerima',
    ];
    let seed = 1337;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 2000; i++) {
      const n = Math.floor(rand() * 9) + 1;
      const parts = Array.from({ length: n }, () => TOKENS[Math.floor(rand() * TOKENS.length)] ?? '');
      assertReceiptInvariants(parseReceiptText(parts.join(rand() < 0.5 ? '\n' : ' ')));
    }
  });
});

describe('receipt-corpus/resolved-findings', () => {
  it('jejak audit temuan yang sudah diperbaiki (status di-assert di array kategori)', () => {
    expect(RECEIPT_RESOLVED_FINDINGS.length).toBeGreaterThan(0);
    for (const k of RECEIPT_RESOLVED_FINDINGS) {
      const r = parseReceiptText(k.input);
      console.log(
        `[receipt-resolved] ${JSON.stringify(k.input.slice(0, 45))} -> ${r ? JSON.stringify({ amount: r.amount, description: r.description, date: r.date, source: r.source, note: r.note }) : 'null'} | sebelum: ${k.actual} | sesudah: ${k.expected}`,
      );
    }
  });
});
