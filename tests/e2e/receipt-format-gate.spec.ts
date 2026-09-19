import { test, expect, type Page } from '@playwright/test';

/**
 * Gerbang validasi upload bukti - tanpa fixture gambar.
 *
 * Spec lain (receipt.spec.ts, chat-upload-scroll.spec.ts) bergantung pada
 * `public/test-receipt.png` / `mandiri.webp` yang di-gitignore, sehingga di CI
 * mereka selalu "skip jujur" dan regresi gerbang format lolos tanpa terdeteksi
 * (itulah yang membuat upload galeri Android & share perbankan rusak lama).
 *
 * Di sini gambar dibuat saat runtime lewat canvas, jadi tidak ada berkas yang
 * perlu dikomit dan tes tidak pernah di-skip.
 */

const FORMAT_ERROR = 'Gunakan gambar JPG, PNG, atau WebP';

async function makeImage(page: Page, mime: 'image/png' | 'image/jpeg'): Promise<Buffer> {
  const dataUrl = await page.evaluate((m) => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = '24px sans-serif';
    ctx.fillText('Total Rp 50.000', 16, 90);
    return canvas.toDataURL(m);
  }, mime);
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

async function openCleanChat(page: Page) {
  await page.goto('/chat');
  await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
  await page.reload();
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
}

interface GateCase {
  readonly name: string;
  /** Format isi gambar yang sebenarnya. */
  readonly bytes: 'image/png' | 'image/jpeg';
  /** MIME yang dilaporkan perangkat - bisa salah label, seperti di perangkat nyata. */
  readonly declared: string;
}

const ACCEPTED: GateCase[] = [
  { name: 'PNG dengan MIME benar', bytes: 'image/png', declared: 'image/png' },
  // Alias non-standar dari sebagian file manager Android.
  { name: 'JPEG sebagai image/jpg', bytes: 'image/jpeg', declared: 'image/jpg' },
  // Persis bug share perbankan: handler share menstempel image/png apa pun isinya.
  { name: 'JPEG distempel image/png', bytes: 'image/jpeg', declared: 'image/png' },
];

for (const c of ACCEPTED) {
  test(`bukti diterima - ${c.name}`, async ({ page }) => {
    await openCleanChat(page);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'receipt.bin',
      mimeType: c.declared,
      buffer: await makeImage(page, c.bytes),
    });
    // Lolos gerbang = OCR mulai jalan (kartu progres muncul) dan tidak ada alert format.
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(FORMAT_ERROR)).toHaveCount(0);
  });
}

test('non-gambar tetap ditolak walau MIME-nya diklaim image/png', async ({ page }) => {
  await openCleanChat(page);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'note.bin',
    mimeType: 'image/png',
    buffer: Buffer.from('ini sama sekali bukan gambar, hanya teks biasa'),
  });
  await expect(page.getByText(FORMAT_ERROR)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});
