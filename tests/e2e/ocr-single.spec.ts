import { test, expect } from '@playwright/test';

test('OCR upload: 6129903704723886619.jpg (Mandiri QR Transfer)', async ({ page }) => {
  test.setTimeout(90_000);
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
  await input.setInputFiles('6129903704723886619.jpg');

  // Wait for OCR progress bar
  await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 5000 });

  // Wait for pending card (OCR done)
  await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 60000 });

  // Extract parsed values
  const desc = await page.locator('#pending-desc').inputValue();
  const amount = await page.locator('#pending-amount').inputValue();
  const date = await page.locator('#pending-date').inputValue();
  const source = await page.locator('#pending-source').inputValue();
  const note = await page.locator('#pending-note').inputValue();

  console.log(`\n========== Mandiri QR Transfer (6129903704723886619.jpg) ==========`);
  console.log(`  Description : ${desc}`);
  console.log(`  Amount      : ${amount}`);
  console.log(`  Date        : ${date}`);
  console.log(`  Source      : ${source || '(kosong)'}`);
  console.log(`  Note        : ${note || '(kosong)'}`);
  console.log(`=============================================================\n`);

  // Basic assertions
  expect(Number(amount)).toBeGreaterThan(0);
  expect(desc.length).toBeGreaterThan(0);
});
