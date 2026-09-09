import { test, expect, type Page, type Locator } from '@playwright/test';
import * as fs from 'node:fs';

const MOBILE = { width: 390, height: 844 };
const KEYBOARD = 300;
const fold = MOBILE.height - KEYBOARD;

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

async function clearDB(page: Page) {
  await page.goto('/chat');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
  await page.reload();
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
}

async function seedMessages(page: Page, count = 8) {
  const ta = page.locator('main textarea');
  const log = page.locator('main [role="log"]');
  await ta.click();
  for (let i = 0; i < count; i++) {
    await ta.fill(`pesan uji nomor ${i} kopi 25rb`);
    await page.keyboard.press('Enter');
    // Tunggu pesan user + assistant reply muncul
    await expect(log).toContainText(`pesan uji nomor ${i}`, { timeout: 5000 });
  }
  // Pastikan pesan terakhir ter-render
  await expect(log).toContainText(`nomor ${count - 1}`, { timeout: 5000 });
}

// ─── Test 1: Keyboard open - composer should not overlap messages ──────────────

test('keyboard terbuka: composer tidak menutupi pesan terbaru', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await clearDB(page);
  await seedMessages(page, 8);

  const list = page.locator('main [role="log"]');
  const composer = page.locator('main form').locator('xpath=..');
  const ta = page.locator('main textarea');

  // Scroll ke bawah dulu
  await list.evaluate((el) => { el.scrollTop = el.scrollHeight; });

  // Buka keyboard
  await ta.click();
  await simulateKeyboardOpen(page, KEYBOARD);

  // Tunggu composer naik
  await expect
    .poll(async () => (await composer.boundingBox())?.y ?? -1)
    .toBeLessThan(fold);

  // Cek: list harus berakhir di sekitar fold (batas keyboard)
  const listBox = await list.boundingBox();
  if (listBox) {
    expect(listBox.y + listBox.height).toBeLessThanOrEqual(fold + 60);
  }

  // Cek: composer harus di atas fold
  const compBox = await composer.boundingBox();
  if (compBox) {
    expect(compBox.y).toBeLessThan(fold);
    // Composer tidak boleh terlalu tinggi (melebihi layar)
    expect(compBox.y).toBeGreaterThan(0);
  }

  // Cek: textarea tetap visible dan bisa diketik
  await expect(ta).toBeVisible();
  await ta.fill('test');
  await expect(ta).toHaveValue('test');
});

// ─── Test 2: Keyboard open - send message from top → auto-scroll ──────────────

test('keyboard terbuka: kirim pesan dari posisi atas → tidak force-scroll', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await clearDB(page);
  await seedMessages(page, 12);

  const list = page.locator('main [role="log"]');
  const ta = page.locator('main textarea');

  // Buka keyboard
  await ta.click();
  await simulateKeyboardOpen(page, KEYBOARD);

  // Scroll ke atas (simulasi user scroll up)
  await list.evaluate((el) => { el.scrollTop = 0; });
  await expect
    .poll(async () => (await list.evaluate((el) => el.scrollTop)))
    .toBe(0);

  // Kirim pesan baru
  await ta.fill('pesan terakhir kopi 50rb');
  await page.keyboard.press('Enter');

  // Tunggu pesan muncul
  await expect(page.locator('main [role="log"]')).toContainText('pesan terakhir', { timeout: 5000 });

  // By design: user di posisi atas TIDAK di-force scroll ke bawah
  // (nearBottom = false → auto-scroll tidak trigger)
  await expect
    .poll(async () => (await list.evaluate((el) => el.scrollTop)), { timeout: 2000 })
    .toBe(0);

  // Tapi pesan baru tetap ada di DOM
  await expect(page.locator('main [role="log"]')).toContainText('pesan terakhir');
});

// ─── Test 3: Upload receipt - pending card should be visible ───────────────────

const RECEIPT = 'mandiri.webp';
const hasReceipt = fs.existsSync(RECEIPT);

test('upload bukti: kartu pending terlihat tanpa scroll manual', async ({ page }) => {
  test.skip(!hasReceipt, `${RECEIPT} tidak ada di project root (gitignored)`);
  await page.setViewportSize(MOBILE);
  await clearDB(page);

  const list = page.locator('main [role="log"]');

  // Upload receipt
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(RECEIPT);

  // Tunggu OCR selesai
  await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 60000 });

  // Cek: kartu pending harus visible (tidak perlu scroll)
  const pendingCard = page.locator('text=Periksa transaksi');
  await expect(pendingCard).toBeVisible();

  // Cek: auto-scroll sudah membawa ke bawah
  await expect
    .poll(async () => {
      const el = await list.elementHandle();
      if (!el) return false;
      return await el.evaluate((e) => {
        return e.scrollHeight - e.scrollTop - e.clientHeight < 200;
      });
    }, { timeout: 3000 })
    .toBe(true);
});

// ─── Test 4: Upload receipt then save - scroll to "Tercatat" ──────────────────

test('upload + simpan: pesan "Tercatat" terlihat setelah save', async ({ page }) => {
  test.skip(!hasReceipt, `${RECEIPT} tidak ada di project root (gitignored)`);
  await page.setViewportSize(MOBILE);
  await clearDB(page);

  const list = page.locator('main [role="log"]');

  // Upload receipt
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(RECEIPT);

  // Tunggu OCR
  await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 60000 });

  // Simpan
  await page.getByRole('button', { name: 'Simpan transaksi' }).click();

  // Tunggu "Tercatat" muncul
  await expect(page.getByText(/Tercatat/)).toBeVisible({ timeout: 10000 });

  // Cek: "Tercatat" harus visible
  const savedMsg = page.getByText(/Tercatat/).first();
  await expect(savedMsg).toBeVisible();

  // Cek: auto-scroll ke bawah
  await expect
    .poll(async () => {
      const el = await list.elementHandle();
      if (!el) return false;
      return await el.evaluate((e) => {
        return e.scrollHeight - e.scrollTop - e.clientHeight < 200;
      });
    }, { timeout: 3000 })
    .toBe(true);
});

// ─── Test 5: Keyboard + upload - keyboard dismisses after OCR ─────────────────

test('keyboard + upload: keyboard tertutup saat upload', async ({ page }) => {
  test.skip(!hasReceipt, `${RECEIPT} tidak ada di project root (gitignored)`);
  await page.setViewportSize(MOBILE);
  await clearDB(page);

  const composer = page.locator('main form').locator('xpath=..');
  const ta = page.locator('main textarea');

  // Buka keyboard dulu
  await ta.click();
  await simulateKeyboardOpen(page, KEYBOARD);

  // Verifikasi keyboard terbuka
  await expect
    .poll(async () => (await composer.boundingBox())?.y ?? -1)
    .toBeLessThan(fold);

  // Blur textarea (tutup keyboard)
  await page.locator('h1').click();
  await expect
    .poll(async () => (await composer.boundingBox())?.y ?? -1)
    .toBeGreaterThan(fold);

  // Upload receipt
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(RECEIPT);

  // Tunggu OCR selesai
  await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 60000 });

  // Cek: composer harus di posisi normal (bukan di atas keyboard)
  const compY = (await composer.boundingBox())?.y ?? 0;
  expect(compY).toBeGreaterThan(fold);
});
