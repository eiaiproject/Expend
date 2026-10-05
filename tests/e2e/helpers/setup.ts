import { expect, type Page } from '@playwright/test';

/** Hapus database IndexedDB agar tiap test mulai dari keadaan kosong. */
export async function resetDatabase(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    () =>
      new Promise<void>((res, rej) => {
        const r = indexedDB.deleteDatabase('ExpendDB');
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error ?? new Error('deleteDatabase failed'));
        r.onblocked = () => res();
      }),
  );
}

/** Buka Settings dengan heading terlihat (bilingual id/en). */
export async function gotoSettings(page: Page): Promise<void> {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /Pengaturan|Settings/ })).toBeVisible();
}
