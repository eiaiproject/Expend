/**
 * Satu-satunya sumber versi untuk kode dan UI.
 *
 * `APP_VERSION` berasal dari `package.json` dan di-inject saat build/dev/test
 * sebagai `__APP_VERSION__` (lihat vite.config.ts + vitest.config.ts). Jadi
 * bump rilis (`npm version` lewat scripts/auto-release.mjs) otomatis sampai ke
 * badge README, CHANGELOG, dan layar Settings tanpa ada angka yang ditulis
 * ulang manual di komponen.
 *
 * Dua sumbu versi lain sengaja TERPISAH dari semver aplikasi, karena mengikat
 * semver ke keduanya justru berbahaya (schema harus monoton, bukan mengikuti
 * rilis fitur):
 * - `EXPORT_FORMAT_VERSION` - versi skema berkas JSON ekspor/impor.
 * - `db.version(N)` Dexie    - versi skema IndexedDB (docs/dexie-migrations.md).
 */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

/** Versi skema payload JSON ekspor/impor (integer, bukan semver aplikasi). */
export const EXPORT_FORMAT_VERSION = 1;
