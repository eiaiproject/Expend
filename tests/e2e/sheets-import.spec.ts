import { test, expect } from '@playwright/test';
import { resetDatabase, gotoSettings } from './helpers/setup';

const SHEETS_CSV = [
  'Tanggal,Penerima,Nominal,Sumber Dana,Catatan,ID,Input,Status',
  '"2026-09-15","Kopi Sheets","25000","GoPay","rapat","T0001","Teks","OK"',
  '"2026-09-16","Teh Sheets","15000","","","T0002","Teks","Perlu dicek"',
].join('\n');

test('impor CSV Sheets: 5 kolom masuk, ID/Status dibuang, Perlu dicek ikut', async ({ page }) => {
  await resetDatabase(page);
  await gotoSettings(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: 'sheets.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(SHEETS_CSV, 'utf-8'),
  });
  await expect(page.getByText(/Sheets/).first()).toBeVisible({ timeout: 8000 });

  await page.goto('/');
  await expect(page.getByText('Kopi Sheets').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Teh Sheets').first()).toBeVisible({ timeout: 10000 });
});
