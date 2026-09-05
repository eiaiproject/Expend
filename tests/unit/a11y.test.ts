import { describe, it, expect } from 'vitest';
import { todayLocalISO } from '../../src/utils/date';

function lum(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

describe('a11y contrast (WCAG AA 4.5 teks utama)', () => {
  it('light: primer/sekunder/muted + tombol aksen lolos', () => {
    expect(ratio('#1A1A1A', '#F7F6F2')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#3D3D2B', '#F7F6F2')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#6b6962', '#F7F6F2')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#ddcbb7', '#264025')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#FFFFFF', '#DC2626')).toBeGreaterThanOrEqual(4.5);
  });
  it('dark: primer/sekunder/muted + tombol aksen-fill lolos', () => {
    expect(ratio('#e8e8e8', '#0a0a0a')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#a0a0a0', '#0a0a0a')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#8a8a8a', '#0a0a0a')).toBeGreaterThanOrEqual(4.5);
    // fill digelapkan (#4a7a2a) agar teks putih lolos AA
    expect(ratio('#FFFFFF', '#4a7a2a')).toBeGreaterThanOrEqual(4.5);
    // aksen teks tetap terang agar tautan lolos di bg gelap
    expect(ratio('#6a9f3e', '#0a0a0a')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('tanggal lokal (utils/date)', () => {
  it('format YYYY-MM-DD dari komponen lokal', () => {
    // 5 Jan 2026 00:30 lokal harus tetap 2026-01-05 (bukan mundur ke UTC kemarin)
    const d = new Date(2026, 0, 5, 0, 30, 0);
    expect(todayLocalISO(d)).toBe('2026-01-05');
  });
  it('default parser memakai tanggal lokal', async () => {
    const { parseChatInput } = await import('../../src/utils/chatParser');
    const r = parseChatInput('kopi 50rb');
    expect(r?.date).toBe(todayLocalISO());
  });
});
