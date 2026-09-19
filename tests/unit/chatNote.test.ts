import { describe, it, expect } from 'vitest';
import { parseChatInput, splitNoteClause } from '../../src/utils/chatParser';

describe('chat note clause (tanpa titik dua, positional guard)', () => {
  it('kopi 25rb note untuk rapat → note terpisah', () => {
    const p = parseChatInput('kopi 25rb note untuk rapat');
    expect(p).not.toBeNull();
    expect(p!.amount).toBe(25000);
    expect(p!.description).toBe('Kopi');
    expect(p!.note).toBe('untuk rapat');
  });

  it('varian keyword ID/EN + colon ditoleransi', () => {
    expect(parseChatInput('kopi 25rb catatan rapat')!.note).toBe('rapat');
    expect(parseChatInput('kopi 25rb notes: follow up')!.note).toBe('follow up');
    expect(parseChatInput('kopi 25rb keterangan dinas')!.note).toBe('dinas');
    expect(parseChatInput('coffee 25rb note for meeting')!.note).toBe('for meeting');
  });

  it('kombinasi sumber + tanggal + note', () => {
    const p = parseChatInput('makan siang 30rb dari BSI kemarin note kasbon');
    expect(p!.amount).toBe(30000);
    expect(p!.source).toBe('BSI');
    expect(p!.note).toBe('kasbon');
  });

  it('angka di catatan tidak dihitung nominal', () => {
    const p = parseChatInput('kopi 25rb note bayar 30rb');
    expect(p!.amount).toBe(25000);
    expect(p!.note).toBe('bayar 30rb');
  });

  it('kata produk bukan catatan: buku catatan / sticky note', () => {
    const a = parseChatInput('beli buku catatan 20rb');
    expect(a!.amount).toBe(20000);
    expect(a!.note).toBeUndefined();
    expect(a!.description).toContain('Catatan');
    const b = parseChatInput('beli sticky note 20rb');
    expect(b!.amount).toBe(20000);
    expect(b!.note).toBeUndefined();
  });

  it('nota (struk) dikecualikan', () => {
    const p = parseChatInput('nota makan 25rb');
    expect(p!.amount).toBe(25000);
    expect(p!.note).toBeUndefined();
  });

  it('keyword tunggal di akhir tanpa isi → dibuang, tanpa note', () => {
    const p = parseChatInput('kopi 25rb catatan');
    expect(p!.amount).toBe(25000);
    expect(p!.description).toBe('Kopi');
    expect(p!.note).toBeUndefined();
  });

  it('tanpa nominal tetap ditolak', () => {
    expect(parseChatInput('note makan siang')).toBeNull();
    expect(parseChatInput('catatan rapat')).toBeNull();
  });

  it('note dibatasi 200 char selaras limit import', () => {
    const p = parseChatInput(`kopi 25rb note ${'x'.repeat(250)}`);
    expect(p!.note!).toHaveLength(200);
  });

  it('tanpa klausa → perilaku lama identik (tanpa key note)', () => {
    const p = parseChatInput('kopi 25rb dari BSI');
    expect(p).toEqual({ description: 'Kopi', amount: 25000, source: 'BSI', date: p!.date });
    expect('note' in p!).toBe(false);
  });

  it('splitNoteClause: head tanpa nominal menolak klausa', () => {
    expect(splitNoteClause('beli buku catatan 20rb')).toEqual({ head: 'beli buku catatan 20rb' });
    expect(splitNoteClause('kopi 25rb note')).toEqual({ head: 'kopi 25rb' });
  });
});
