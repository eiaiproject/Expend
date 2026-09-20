import { existsSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/**
 * OCR harus jalan dari aset sendiri (hasil `npm run vendor:ocr`), bukan CDN
 * pihak ketiga (cdn.jsdelivr.net / tessdata.projectnaptha.com).
 *
 * Dua sudut pembuktian, sengaja dipisah:
 *  1. Pengamatan pasif di semua browser: selama OCR, tidak boleh ada satu pun
 *     request ke host pihak ketiga, dan worker/core/model harus datang dari
 *     `/tesseract/` dengan status 200.
 *  2. Pemblokiran aktif (chromium): seluruh host selain origin aplikasi di-abort,
 *     dan OCR tetap harus selesai - ini yang membuktikan klaim "offline-first"
 *     bukan hanya "kebetulan tidak ada request ke luar".
 *
 * Setiap `test.skip` di bawah diberi komentar alasannya tepat di atasnya
 * (Sonar S1607: test yang dilewati harus punya alasan), sama seperti
 * tests/e2e/receipt.spec.ts.
 */

const REQUIRED_ASSETS = [
  'public/tesseract/worker.min.js',
  'public/tesseract/tesseract-core-simd-lstm.wasm.js',
  'public/tesseract/lang/ind.traineddata.gz',
];

const THIRD_PARTY_HOSTS = /jsdelivr|projectnaptha|unpkg|cdnjs/i;

/** Bukti sintetis berukuran wajar supaya Tesseract punya cukup piksel. */
async function makeReceipt(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('INDOMARET', 40, 110);
    ctx.font = '34px sans-serif';
    ctx.fillText('Tanggal 20-09-2026', 40, 190);
    ctx.fillText('Total Rp 25.000', 40, 280);
    return canvas.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

async function openCleanChat(page: Page) {
  await page.goto('/chat');
  await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
  await page.reload();
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
}

async function uploadReceipt(page: Page) {
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    buffer: await makeReceipt(page),
  });
}

test('OCR memakai aset lokal dan tidak menyentuh host pihak ketiga', async ({ page }) => {
  // Dilewati hanya bila aset OCR belum di-vendor di checkout ini (mis. clone
  // segar tanpa `npm run vendor:ocr`); CI selalu menjalankannya lebih dulu.
  test.skip(
    !REQUIRED_ASSETS.every((p) => existsSync(p)),
    'aset OCR belum di-vendor - jalankan `npm run vendor:ocr` lebih dulu',
  );
  test.setTimeout(180_000);

  const localOcrAssets: string[] = [];
  const thirdParty = new Set<string>();
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (THIRD_PARTY_HOSTS.test(url.hostname)) thirdParty.add(url.origin);
    if (url.pathname.startsWith('/tesseract/')) localOcrAssets.push(url.pathname);
  });

  await openCleanChat(page);
  await uploadReceipt(page);

  // Kartu verifikasi = OCR selesai dan hasilnya masuk akal.
  await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Rp\s*25\.000/).first()).toBeVisible();

  expect([...thirdParty], 'request ke domain pihak ketiga selama OCR').toEqual([]);
  console.log('aset OCR lokal yang diambil:', localOcrAssets);
  for (const asset of ['/tesseract/worker.min.js', '/tesseract/tesseract-core-', '/tesseract/lang/ind.traineddata.gz', '/tesseract/lang/eng.traineddata.gz']) {
    expect(localOcrAssets.join(' '), `${asset} diambil dari origin sendiri`).toContain(asset);
  }
  // Bukti terkuat: model hanya boleh datang dari origin sendiri.
  expect(localOcrAssets.filter((p) => p.endsWith('.traineddata.gz')).sort()).toEqual([
    '/tesseract/lang/eng.traineddata.gz',
    '/tesseract/lang/ind.traineddata.gz',
  ]);
});

test('OCR tetap selesai saat semua host pihak ketiga diblokir', async ({ page, context }) => {
  // Alasan yang sama seperti test di atas: tanpa aset lokal, memblokir host luar
  // tidak membuktikan apa pun karena OCR memang belum bisa dijalankan.
  test.skip(
    !REQUIRED_ASSETS.every((p) => existsSync(p)),
    'aset OCR belum di-vendor - jalankan `npm run vendor:ocr` lebih dulu',
  );
  // Route interception Playwright mengganggu subresource yang di-`importScripts`
  // dari worker blob di webkit (asetnya 200, tetapi OCR gagal dengan pesan
  // model). Klaimnya tetap terjaga karena test di atas berjalan di webkit juga.
  test.skip(test.info().project.name === 'webkit', 'route interception mengganggu worker blob di webkit');
  test.setTimeout(180_000);

  const blocked = new Set<string>();
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    blocked.add(url.origin);
    return route.abort();
  });

  await openCleanChat(page);
  await uploadReceipt(page);

  await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Rp\s*25\.000/).first()).toBeVisible();
  // Kalau tesseract masih menarik aset dari CDN, OCR di atas sudah gagal lebih dulu.
  expect([...blocked].filter((h) => THIRD_PARTY_HOSTS.test(h)), 'host pihak ketiga yang diblokir').toEqual([]);
});
