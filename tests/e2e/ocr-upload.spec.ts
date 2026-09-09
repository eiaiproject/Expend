import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const IMAGES = [
  { file: 'bca.webp', label: 'BCA' },
  { file: 'gopay.webp', label: 'GoPay' },
  { file: 'jago.webp', label: 'Jago' },
  { file: 'mandiri.webp', label: 'Mandiri' },
  { file: 'seabank.webp', label: 'SeaBank' },
];

for (const img of IMAGES) {
  test(`OCR upload: ${img.label} (${img.file})`, async ({ page }) => {
    const filePath = path.resolve(img.file);
    test.skip(!fs.existsSync(filePath), `${img.file} tidak ditemukan di project root`);

    // Clear DB
    await page.goto('/');
    await page.evaluate(
      () =>
        new Promise<void>((res, rej) => {
          const r = indexedDB.deleteDatabase('ExpendDB');
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
          r.onblocked = () => res();
        }),
    );
    await page.reload();

    // Go to chat
    await page.goto('/chat');
    await page.waitForSelector('main', { timeout: 5000 });

    // Upload image
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles(filePath);

    // Wait for OCR progress bar to appear
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 5000 });

    // Wait for "Periksa transaksi" card (pending card) to appear (OCR done)
    await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 30000 });

    // Extract parsed values from the pending card
    const desc = await page.locator('#pending-desc').inputValue();
    const amount = await page.locator('#pending-amount').inputValue();
    const date = await page.locator('#pending-date').inputValue();
    const source = await page.locator('#pending-source').inputValue();
    const note = await page.locator('#pending-note').inputValue();

    // Print result
    console.log(`\n========== ${img.label} (${img.file}) ==========`);
    console.log(`  Description : ${desc}`);
    console.log(`  Amount      : ${amount}`);
    console.log(`  Date        : ${date}`);
    console.log(`  Source      : ${source || '(kosong)'}`);
    console.log(`  Note        : ${note || '(kosong)'}`);
    console.log(`====================================\n`);

    // Basic assertions — amount should be > 0
    expect(Number(amount)).toBeGreaterThan(0);
    // Description should not be empty
    expect(desc.length).toBeGreaterThan(0);
  });
}
