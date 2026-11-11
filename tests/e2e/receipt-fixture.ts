import type { Page } from '@playwright/test';

/**
 * Resi sintetis dibuat di browser saat test berjalan. Tidak ada berkas biner
 * yang perlu dikomit, dan spec tidak pernah di-skip karena fixture hilang.
 */
export async function makeReceiptImage(page: Page, lines: readonly string[]): Promise<Buffer> {
  const dataUrl = await page.evaluate((texts) => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    let y = 70;
    for (const line of texts) {
      const bold = /total|toko/i.test(line);
      ctx.font = `${bold ? 'bold ' : ''}${bold ? 46 : 36}px sans-serif`;
      ctx.fillText(line, 50, y);
      y += bold ? 100 : 70;
    }
    return canvas.toDataURL('image/png');
  }, lines);
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

export const SCROLL_RECEIPT_LINES = ['Toko Kopi', 'Tanggal 31-08-2026', 'Total Rp 52.500'] as const;
