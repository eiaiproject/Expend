import { test, expect, type Page, type Locator } from '@playwright/test';

// Mensimulasikan keyboard virtual mobile tanpa perangkat asli:
// visualViewport.height dikurangi sambil textarea tetap fokus, lalu event
// resize dikirim. Getter `height`/`offsetTop` adalah atribut WebIDL pada
// prototype VisualViewport (configurable), jadi aman di-override per-test.
async function simulateKeyboardOpen(page: Page, keyboardPx = 300) {
  await page.evaluate((px) => {
    const vv = window.visualViewport as unknown as { dispatchEvent(e: Event): boolean };
    const proto = Object.getPrototypeOf(vv) as { height?: number; offsetTop?: number };
    const inner = window.innerHeight;
    Object.defineProperty(proto, 'height', { configurable: true, get: () => inner - px });
    Object.defineProperty(proto, 'offsetTop', { configurable: true, get: () => 0 });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  }, keyboardPx);
}

const MOBILE = { width: 390, height: 844 };
const KEYBOARD = 300;
const fold = MOBILE.height - KEYBOARD; // batas atas keyboard simulasi

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
