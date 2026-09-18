import { test, expect, type Page, type Locator } from '@playwright/test';
import { simulateKeyboardOpen, MOBILE, KEYBOARD, fold } from './helpers/keyboard';

// Isi chat sampai overflow; tiap pesan ditunggu benar-benar masuk
// (user + balasan asisten "Tercatat") - tanpa fixed wait.
async function seedMessages(page: Page, ta: Locator, msgs: Locator, count = 14) {
  await ta.click();
  for (let i = 0; i < count; i++) {
    await ta.fill(`pesan uji nomor ${i} kopi 25rb`);
    const before = await msgs.count();
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      (c) => {
        const l = document.querySelector('main [role="log"]');
        return !!l && l.children.length > c + 1;
      },
      before,
      { timeout: 5000 },
    );
  }
  // Settle: pastikan seed terakhir benar-benar ter-render (locator sengaja
  // di level log agar kebal anchor kosong endRef & kartu pending).
  await expect(page.locator('main [role="log"]')).toContainText('nomor 13', { timeout: 5000 });
}

async function openChat(page: Page) {
  await page.setViewportSize(MOBILE);
  await page.goto('/chat');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
  await page.reload();
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  const ta = page.locator('main textarea');
  const msgs = page.locator('main [role="log"] > div');
  await seedMessages(page, ta, msgs);
  return { ta, msgs };
}

// Pesan terbaru harus berada di atas composer (tidak tertutup/tergeser ke balik keyboard).
async function expectLastMessageAboveComposer(msgs: Locator, composer: Locator) {
  await expect
    .poll(async () => {
      const last = await msgs.last().boundingBox();
      const comp = await composer.boundingBox();
      if (!last || !comp) return null;
      return last.y + last.height <= comp.y + 1;
    }, { timeout: 5000 })
    .toBe(true);
}

test('composer merapat saat keyboard virtual terbuka & pulih saat blur', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/chat');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

  // Wrapper composer = parent dari form (memegang padding bawah dinamis).
  const composer = page.locator('main form').locator('xpath=..');

  // State awal (keyboard tertutup): padding bawah ~66px (ruang BottomNav).
  // (Hint desktop-only, jadi padding satu-satunya sinyal yang valid di mobile.)
  const pbBefore = await composer.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(pbBefore).toBeGreaterThan(50);

  // Fokus textarea (dibutuhkan agar inset dihitung) lalu "buka" keyboard.
  await page.locator('main textarea').click();
  await simulateKeyboardOpen(page);

  // State keyboard terbuka: padding bawah mengecil (~10px).
  await expect
    .poll(async () => composer.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)))
    .toBeLessThan(20);
  // Composer naik: dasar composer tepat di batas atas keyboard.
  await expect
    .poll(async () => (await composer.boundingBox())?.y ?? -1)
    .toBeLessThan(fold);
  await expect(page.locator('main textarea')).toBeVisible();

  // Tutup keyboard: blur → inset 0 setelah delay ~300ms → padding pulih.
  await page.locator('h1').click();
  await expect
    .poll(async () => composer.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)))
    .toBeGreaterThan(50);
});

test('pesan terbaru tetap terlihat di atas composer saat keyboard terbuka', async ({ page }) => {
  const { ta, msgs } = await openChat(page);
  const list = page.locator('main [role="log"]');
  const composer = page.locator('main form').locator('xpath=..');

  // Keyboard terbuka → composer naik (dasar ≈ fold) & scroll list ke bawah.
  await ta.click();
  await simulateKeyboardOpen(page, KEYBOARD);
  await expect
    .poll(async () => (await composer.boundingBox())?.y ?? -1)
    .toBeLessThan(fold);
  await list.evaluate((el) => { el.scrollTop = el.scrollHeight; });

  // Pesan terakhir (terbaru) tetap terlihat penuh di atas composer.
  await expectLastMessageAboveComposer(msgs, composer);

  // Kirim pesan BARU saat keyboard masih terbuka → auto-scroll menempatkannya
  // di atas composer, bukan tersembunyi di balik keyboard.
  const beforeSend = await msgs.count();
  await ta.fill('pesan terakhir kopi 50rb');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (c) => {
      const l = document.querySelector('main [role="log"]');
      return !!l && l.children.length > c;
    },
    beforeSend,
    { timeout: 5000 },
  );
  await expectLastMessageAboveComposer(msgs, composer);
});

// Regresi landscape: md:pt-6 di main mendorong composer ke bawah viewport
// saat keyboard terbuka (tombol kirim terpotong ~27px). Dasar composer harus
// merapat ke vv.height + vv.offsetTop (toleransi 5px, guard DEV memakai 4px).
test('composer tetap docked saat landscape + keyboard terbuka', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/chat');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  const composer = page.locator('main form').locator('xpath=..');
  await page.locator('main textarea').click();
  await simulateKeyboardOpen(page, 200);
  await expect
    .poll(async () => {
      const box = await composer.boundingBox();
      const vv = await page.evaluate(() => ({
        h: window.visualViewport!.height,
        t: window.visualViewport!.offsetTop,
      }));
      if (!box) return 999;
      return Math.abs(box.y + box.height - (vv.h + vv.t));
    }, { timeout: 5000 })
    .toBeLessThanOrEqual(5);
  // Tombol kirim terlihat penuh (tidak terpotong keyboard).
  await expect(page.getByRole('button', { name: 'Kirim transaksi' })).toBeVisible();
});
