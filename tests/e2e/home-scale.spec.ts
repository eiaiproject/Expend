import { test, expect, type Page } from '@playwright/test';

/**
 * Ringkasan dengan data besar.
 *
 * Sebelum paging, 1.000 transaksi merender 1.000 baris (masing-masing dengan 2
 * tombol) dalam satu pass. Spec ini menjaga dua hal: daftar tetap terbatas, dan
 * muat pertama tetap di bawah anggaran DOM + tidak ada long task yang mengunci
 * main thread.
 */

const SEED = 300;

async function seedTransactions(page: Page, count: number) {
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
  // Reload supaya Dexie membuat skema sendiri (tanpa menduplikasi definisi store).
  await page.reload();
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

  await page.evaluate(async (n) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('ExpendDB');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const base = Date.UTC(2026, 0, 1);
    for (let i = 0; i < n; i++) {
      const at = new Date(base + i * 86_400_000).toISOString();
      store.add({ description: `Transaksi ${i}`, amount: 10_000 + i, date: at.slice(0, 10), createdAt: at });
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, count);

  await page.reload();
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
}

test('daftar 300 hari dibatasi 30 grup, sisanya lewat tombol', async ({ page }) => {
  await seedTransactions(page, SEED);

  const rows = page.locator('[aria-label="Transaksi terbaru"] li');
  await expect(rows).toHaveCount(30, { timeout: 10000 });

  const more = page.getByRole('button', { name: /Tampilkan \d+ berikutnya/ });
  await expect(more).toBeVisible();
  await expect(more).toHaveText(`Tampilkan ${SEED - 30} berikutnya`);

  await more.click();
  await expect(rows).toHaveCount(60);
});

test('muat pertama tetap di bawah anggaran DOM dan long task', async ({ page }) => {
  // Long task diukur sejak dokumen mulai dieksekusi.
  await page.addInitScript(() => {
    (window as unknown as { __longTasks: number[] }).__longTasks = [];
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) (window as unknown as { __longTasks: number[] }).__longTasks.push(entry.duration);
    });
    try {
      obs.observe({ entryTypes: ['longtask'] });
    } catch {
      /* browser tanpa longtask: anggaran ini dilewati */
    }
  });

  await seedTransactions(page, SEED);

  const stats = await page.evaluate(() => ({
    nodes: document.querySelectorAll('*').length,
    longTasks: (window as unknown as { __longTasks?: number[] }).__longTasks ?? [],
    supportsLongTask: typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask'),
  }));
  const worst = stats.longTasks.length ? Math.max(...stats.longTasks) : 0;
  console.log(`DOM nodes: ${stats.nodes} | long task terburuk: ${worst.toFixed(0)} ms (${stats.longTasks.length} kejadian)`);

  // Terukur: 741 node. Tanpa paging, 300 baris menambah ~3.000 node (≈3.700),
  // jadi ambang ini memisahkan "dibatasi" dari "render semua" dengan lega.
  expect(stats.nodes).toBeLessThan(1500);
  if (stats.supportsLongTask) expect(worst).toBeLessThan(600);
});
