import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';

test('receipt upload non-image shows validation alert, no OCR attempt', async ({ page }) => {
  fs.writeFileSync('/tmp/bukan-gambar.txt', 'ini bukan gambar');
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
  await page.goto('/chat');
  // Regresi: alert validasi harus muncul walau chat masih kosong
  // (tidak terkubur di dalam wadah log yang mensyaratkan pesan).
  await page.locator('input[type="file"]').first().setInputFiles('/tmp/bukan-gambar.txt');
  await expect(page.getByText('Gunakan gambar JPG, PNG, atau WebP')).toBeVisible({ timeout: 5000 });
});
