import { describe, it, expect } from 'vitest';
import { parseReceiptText } from '../../src/utils/receiptParser';
import { OCR_RECEIPTS } from '../fixtures/ocr-receipts';

/**
 * Dataset-driven test untuk resi/notifikasi transfer multi-bank.
 * Lihat tests/fixtures/ocr-receipts.ts - tambahkan format baru di sana.
 */
describe('parseReceiptText - dataset OCR multi-bank', () => {
  it('dataset terisi', () => {
    expect(OCR_RECEIPTS.length).toBeGreaterThan(0);
  });

  for (const fx of OCR_RECEIPTS) {
    it(fx.name, () => {
      const r = parseReceiptText(fx.text);
      expect(r).not.toBeNull();
      expect(r!.amount).toBe(fx.expected.amount);
      if (fx.expected.description !== undefined) {
        expect(r!.description).toBe(fx.expected.description);
      }
      expect(r!.source).toBe(fx.expected.source);
      if (fx.expected.date !== undefined) {
        expect(r!.date).toBe(fx.expected.date);
      }
      if (fx.expected.note !== undefined) {
        expect(r!.note).toBe(fx.expected.note);
      }
    });
  }
});
