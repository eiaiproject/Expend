import { test, expect, type Page } from '@playwright/test';
import { simulateKeyboardOpen, MOBILE, KEYBOARD, fold } from './helpers/keyboard';

async function seedOneTransaction(page: Page) {
  await page.goto('/');
  await page.evaluate(() => new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase('ExpendDB');
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
    r.onblocked = () => res();
  }));
  await page.reload();
  await page.goto('/chat');
  await expect(page.getByPlaceholder(/Contoh/)).toBeVisible({ timeout: 10000 });
  await page.getByPlaceholder(/Contoh/).fill('beli kopi di Indomaret 50000');
  await page.getByRole('button', { name: 'Kirim transaksi' }).click();
  await expect(page.getByText('Siap dicatat').first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Simpan transaksi' }).click();
  await expect(page.getByText(/Tercatat/).first()).toBeVisible({ timeout: 8000 });
}

// Regresi: di Android keyboard membuka visual viewport tanpa mengecilkan
// layout viewport. Modal `position: fixed` tetap menempel ke viewport layout,
// sehingga bottom-sheet Edit transaksi berakhir di belakang keyboard dan
// tombol Simpan tak terjangkau. Form harus berhenti tepat di atas keyboard.
test('Edit transaksi tetap terjangkau saat keyboard Android terbuka', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await seedOneTransaction(page);

  await page.goto('/');
  const editBtn = page.locator('button[aria-label^="Edit transaksi"]').first();
  await expect(editBtn).toBeVisible({ timeout: 10000 });
  await editBtn.click();

  const dialog = page.locator('dialog[aria-modal="true"]');
  await expect(dialog).toBeVisible();
  const form = dialog.locator('form');
  await expect(form).toBeVisible();
  // Fokus field deskripsi (input pertama) → syarat agar Shell ikut mengecil
  // (isEditableElement memeriksa activeElement saat visualViewport resize).
  await dialog.locator('input').first().click();
  await simulateKeyboardOpen(page, KEYBOARD);

  // Kontainer modal harus berhenti di batas atas keyboard, bukan 300px di
  // baliknya (dulu: dasar = 844 = viewport layout).
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box ? Math.round(box.y + box.height) : Number.MAX_SAFE_INTEGER;
    }, { timeout: 5000 })
    .toBeLessThanOrEqual(fold + 1);

  // Form lebih tinggi dari sisa ruang → wajib bisa di-scroll sampai tombol
  // Simpan terjangkau dan benar-benar bisa di-hit (tidak ter-clip/tertutup).
  const save = dialog.getByRole('button', { name: 'Simpan' });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeVisible();
  const hittable = await save.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (el === top || el.contains(top));
  });
  expect(hittable).toBe(true);
  // Area scroll harus berada di dalam Shell (bukan meluap ke balik keyboard).
  const overflowsShell = await dialog.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(overflowsShell).toBe(true);
});

// Layar pendek + keyboard besar: form lebih tinggi dari area tersisa, jadi
// modal wajib bisa di-scroll agar field atas (Deskripsi) tetap terjangkau.
test('form Edit transaksi bisa di-scroll saat keyboard menyisakan ruang sedikit', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seedOneTransaction(page);

  await page.goto('/');
  const editBtn = page.locator('button[aria-label^="Edit transaksi"]').first();
  await expect(editBtn).toBeVisible({ timeout: 10000 });
  await editBtn.click();

  const dialog = page.locator('dialog[aria-modal="true"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('input').first().click();
  await simulateKeyboardOpen(page, 320);

  // Field Deskripsi (paling atas) harus bisa dicapai dengan scroll.
  const desc = dialog.locator('input').first();
  await desc.scrollIntoViewIfNeeded();
  await expect(desc).toBeVisible();
  const reachable = await desc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (el === top || el.contains(top));
  });
  expect(reachable).toBe(true);
});
