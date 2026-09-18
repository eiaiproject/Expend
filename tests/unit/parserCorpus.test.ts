import { describe, it, expect } from 'vitest';
import { parseChatInput } from '../../src/utils/chatParser';
import { parseReceiptText } from '../../src/utils/receiptParser';
import {
  AMOUNT_PLAIN,
  AMOUNT_SEPARATORS,
  AMOUNT_SUFFIX,
  AMOUNT_CURRENCY,
  AMOUNT_BOUNDS,
  DATES_RELATIVE,
  DATES_EXPLICIT,
  SOURCES_CLAUSE,
  SOURCES_BARE,
  SOURCES_FALSE_POSITIVE,
  NOTES,
  DESCRIPTION_FORMAT,
  ACRONYMS,
  MULTI_NUMBERS,
  REF_NUMBERS,
  ENGLISH,
  ADVERSARIAL,
  RECEIPT_TEXTS,
  INVALID_DATES,
  KNOWN_ISSUES,
  type ChatCase,
} from '../fixtures/chat-input-corpus';
import { todayLocalISO } from '../../src/utils/date';

const MAX_AMOUNT = 1_000_000_000_000;
const MAX_DESC = 80;
const MAX_NOTE = 200;
const MAX_SOURCE = 80;

const GROUPS: Record<string, ChatCase[]> = {
  'amount-plain': AMOUNT_PLAIN,
  'amount-separators': AMOUNT_SEPARATORS,
  'amount-suffix': AMOUNT_SUFFIX,
  'amount-currency': AMOUNT_CURRENCY,
  'amount-bounds': AMOUNT_BOUNDS,
  'dates-relative': DATES_RELATIVE,
  'dates-explicit': DATES_EXPLICIT,
  'sources-clause': SOURCES_CLAUSE,
  'sources-bare': SOURCES_BARE,
  'sources-false-positive': SOURCES_FALSE_POSITIVE,
  notes: NOTES,
  'description-format': DESCRIPTION_FORMAT,
  acronyms: ACRONYMS,
  'multi-numbers': MULTI_NUMBERS,
  'ref-numbers': REF_NUMBERS,
  english: ENGLISH,
};

function assertChatInvariants(r: ReturnType<typeof parseChatInput>): void {
  if (!r) return;
  expect(Number.isFinite(r.amount)).toBe(true);
  expect(r.amount).toBeGreaterThan(0);
  expect(r.amount).toBeLessThanOrEqual(MAX_AMOUNT);
  expect(typeof r.description).toBe('string');
  expect(r.description.length).toBeGreaterThan(0);
  expect(r.description.length).toBeLessThanOrEqual(MAX_DESC);
  if (r.note !== undefined) expect(r.note.length).toBeLessThanOrEqual(MAX_NOTE);
  if (r.source !== undefined) expect(r.source.length).toBeLessThanOrEqual(MAX_SOURCE);
  if (r.date !== undefined) expect(typeof r.date === 'string' && r.date.length > 0).toBe(true);
}

for (const [group, cases] of Object.entries(GROUPS)) {
  describe(`corpus/${group}`, () => {
    it.each(cases.map((c) => [c.input, c] as const))('%s', (input, c) => {
      const r = parseChatInput(input);
      assertChatInvariants(r);
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
      if (e.source !== undefined) expect(r.source).toBe(e.source);
      if (e.note !== undefined) expect(r.note).toBe(e.note);
      if (e.date !== undefined) expect(r.date).toBe(e.date);
    });
  });
}

describe('corpus/adversarial', () => {
  it('tidak pernah throw dan tetap menghormati batas', () => {
    for (const input of ADVERSARIAL) {
      assertChatInvariants(parseChatInput(input));
    }
  });

  it('bebas ReDoS: setiap input selesai jauh di bawah 100ms', () => {
    let worst = { input: '', ms: 0 };
    for (const input of ADVERSARIAL) {
      const t0 = performance.now();
      parseChatInput(input);
      const ms = performance.now() - t0;
      if (ms > worst.ms) worst = { input: input.slice(0, 40), ms };
    }
    console.log(`[corpus] parse terberat: ${worst.ms.toFixed(2)}ms (${JSON.stringify(worst.input)})`);
    expect(worst.ms).toBeLessThan(100);
  });

  it('fuzz: kombinasi token acak tidak pernah throw', () => {
    const TOKENS = [
      'kopi', '25rb', '50.000', 'dari', 'ke', 'BCA', 'note', 'catatan', 'tgl',
      '15/08/2026', 'Rp', 'jt', 'k', '1.5', 'kemarin', 'di', 'lantai', '2',
      'ref', '1234567890', '☕', '<script>', '=1+1', '', '(', ')', ',', '.', '-', '9999999999999999',
    ];
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 3000; i++) {
      const n = Math.floor(rand() * 8) + 1;
      const input = Array.from({ length: n }, () => TOKENS[Math.floor(rand() * TOKENS.length)] ?? '').join(' ');
      assertChatInvariants(parseChatInput(input));
    }
  });
});

describe('corpus/receipt', () => {
  it.each(RECEIPT_TEXTS.map((text) => [text.slice(0, 40), text] as const))('receipt: %s', (_label, text) => {
    const r = parseReceiptText(text);
    if (!r) return;
    expect(Number.isFinite(r.amount)).toBe(true);
    expect(r.amount).toBeGreaterThan(0);
    expect(r.amount).toBeLessThanOrEqual(MAX_AMOUNT);
    expect(r.description.length).toBeGreaterThan(0);
    expect(r.description.length).toBeLessThanOrEqual(MAX_DESC);
    expect(typeof r.date === 'string' && r.date.length > 0).toBe(true);
    // Jendela scan receipt kini 4000 char (dulu 500) - lihat MAX_SCAN.
    expect(r.rawText.length).toBeLessThanOrEqual(4000);
    if (r.note !== undefined) expect(r.note.length).toBeLessThanOrEqual(MAX_DESC);
    if (r.source !== undefined) expect(r.source.length).toBeLessThanOrEqual(MAX_SOURCE);
  });
});

describe('corpus/invalid-dates', () => {
  it.each(INVALID_DATES)('%s', (input) => {
    const r = parseChatInput(input);
    expect(r).not.toBeNull();
    expect(r!.date).toBe(todayLocalISO());
    expect(r!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('corpus/known-issues', () => {
  it('log perilaku yang diduga belum ideal (dokumentasi, tidak di-assert)', () => {
    for (const k of KNOWN_ISSUES) {
      const r = parseChatInput(k.input);
      console.log(
        `[known-issue] ${JSON.stringify(k.input)} -> ${r ? JSON.stringify(r) : 'null'} | actual: ${k.actual} | expected: ${k.expected}`,
      );
    }
  });
});
