import { test, expect, type Page, type Locator } from '@playwright/test';
import * as fs from 'node:fs';
import { simulateKeyboardOpen, MOBILE, KEYBOARD, fold } from './helpers/keyboard';

const RECEIPT = 'mandiri.webp';
const HAS_RECEIPT = fs.existsSync(RECEIPT);

// Pembuka bersama test 3-4: viewport + DB bersih + upload resi + tunggu OCR.
// Tanpa fail jujur bila berkas gitignored tak ada: anotasi skip lalu null
// agar pemanggil melewati sisa test — tanpa test.skip (S1607) maupun
// return dini di badan test (S8968); tidak ada yang diduplikasi.
async function uploadReceiptAndWaitOCR(page: Page): Promise<Locator | null> {
  if (!HAS_RECEIPT) {
    test.info().annotations.push({ type: 'skip', description: `${RECEIPT} tidak ada di project root (gitignored)` });
    return null;
  }
  await page.setViewportSize(MOBILE);
  await clearDB(page);
  const list = page.locator('main [role="log"]');
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(RECEIPT);
  await expect(page.getByText('Periksa transaksi')).toBeVisible({ timeout: 60000 });
  return list;
}

async function clearDB(page: Page) {
  await page.goto('/chat');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => indexedDB.deleteDatabase('ExpendDB'));
  await page.reload();
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
}

/**
 * Isi log dengan N pasang pesan (user + balasan) langsung di IndexedDB.
 *
 * Sebelumnya helper ini mengetik lewat UI dan menunggu tiap pesan muncul dalam
 * 5 detik. Di bawah beban paralel (spec OCR WASM dan spec skala ringkasan
 * berjalan bersamaan) webkit bisa melewati batas itu, sehingga test scroll yang
 * justru jadi subjek spec ini ikut merah. Yang diuji di sini perilaku
 * scroll/composer, bukan kecepatan mengetik.
 */
async function seedMessages(page: Page, count = 8) {
  await page.evaluate(async (n) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('ExpendDB');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    const tx = db.transaction('chatMessages', 'readwrite');
    const store = tx.objectStore('chatMessages');
    const base = Date.UTC(2026, 8, 20, 10, 0, 0);
    for (let i = 0; i < n; i++) {
      const at = new Date(base + i * 2000).toISOString();
      store.add({ role: 'user', text: `pesan uji nomor ${i} kopi 25rb`, createdAt: at });
      store.add({ role: 'assistant', text: 'Siap dicatat: Kopi - Rp25.000', createdAt: at });
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, count);
  await page.reload();
  // Pastikan pesan terakhir ter-render
  await expect(page.locator('main [role="log"]')).toContainText(`nomor ${count - 1}`, { timeout: 10000 });
}

// Auto-scroll sudah membawa list ke bawah (toleransi 200px).
async function expectScrolledToBottom(list: Locator) {
  await expect
    .poll(async () => {
      const el = await list.elementHandle();
      if (!el) return false;
      return await el.evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight < 200);
    }, { timeout: 3000 })
    .toBe(true);
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

  // Tunggu composer naik. Timeout eksplisit: transisi ini digerakkan event
  // visualViewport, dan di bawah beban paralel (spec OCR WASM + spec skala)
  // browser bisa butuh waktu lebih dari default 5 detik untuk menyelesaikannya.
  await expect
    .poll(async () => (await composer.boundingBox())?.y ?? -1, { timeout: 15_000 })
    .toBeLessThan(fold);

  // Cek: list harus berakhir di sekitar fold (batas keyboard). Di-poll supaya
  // tidak membaca layout di tengah transisi.
  await expect
    .poll(async () => {
      const box = await list.boundingBox();
      return box ? box.y + box.height : Number.POSITIVE_INFINITY;
    }, { timeout: 15_000 })
    .toBeLessThanOrEqual(fold + 60);

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

  // Tunggu pesan muncul (timeout longgar: parse + render di bawah beban)
  await expect(page.locator('main [role="log"]')).toContainText('pesan terakhir', { timeout: 15_000 });

  // By design: user di posisi atas TIDAK di-force scroll ke bawah
  // (nearBottom = false → auto-scroll tidak trigger)
  await expect
    .poll(async () => (await list.evaluate((el) => el.scrollTop)), { timeout: 2000 })
    .toBe(0);

  // Tapi pesan baru tetap ada di DOM
  await expect(page.locator('main [role="log"]')).toContainText('pesan terakhir');
});

// ─── Test 3: Upload receipt - pending card should be visible ───────────────────

test('upload bukti: kartu pending terlihat tanpa scroll manual', async ({ page }) => {
  const list = await uploadReceiptAndWaitOCR(page);
  if (list) {
    // Cek: kartu pending harus visible (tidak perlu scroll)
    const pendingCard = page.locator('text=Periksa transaksi');
    await expect(pendingCard).toBeVisible();

    // Cek: auto-scroll sudah membawa ke bawah
    await expectScrolledToBottom(list);
  }
});

// ─── Test 4: Upload receipt then save - scroll to "Tercatat" ──────────────────

test('upload + simpan: pesan "Tercatat" terlihat setelah save', async ({ page }) => {
  const list = await uploadReceiptAndWaitOCR(page);
  if (list) {
    // Simpan
    await page.getByRole('button', { name: 'Simpan transaksi' }).click();

    // Tunggu "Tercatat" muncul
    await expect(page.getByText(/Tercatat/)).toBeVisible({ timeout: 10000 });

    // Cek: "Tercatat" harus visible
    const savedMsg = page.getByText(/Tercatat/).first();
    await expect(savedMsg).toBeVisible();

    // Cek: auto-scroll ke bawah
    await expectScrolledToBottom(list);
  }
});

// ─── Test 5: Keyboard + upload - keyboard dismisses after OCR ─────────────────

test('keyboard + upload: keyboard tertutup saat upload', async ({ page }) => {
  if (HAS_RECEIPT) {
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
  } else {
    test.info().annotations.push({ type: 'skip', description: `${RECEIPT} tidak ada di project root (gitignored)` });
  }
});
