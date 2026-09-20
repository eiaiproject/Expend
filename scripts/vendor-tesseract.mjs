#!/usr/bin/env node
/**
 * vendor-tesseract.mjs
 *
 * Menyalin aset OCR ke `public/tesseract/` supaya worker + core + model bahasa
 * disajikan dari origin sendiri, bukan dari CDN pihak ketiga
 * (cdn.jsdelivr.net / tessdata.projectnaptha.com). Dampaknya:
 *
 *   - OCR tidak lagi bergantung jaringan ke domain orang lain; aset masuk ke
 *     cache Service Worker (`ocr-cache`, CacheFirst) sehingga OCR berikutnya
 *     jalan penuh offline.
 *   - Tidak ada kebocoran request ke pihak ketiga dari aplikasi yang
 *     mengklaim privacy-first.
 *
 * Tata letak yang dihasilkan (persis yang diharapkan tesseract.js):
 *   public/tesseract/worker.min.js
 *   public/tesseract/tesseract-core-simd-lstm.wasm.js
 *   public/tesseract/tesseract-core-lstm.wasm.js
 *   public/tesseract/lang/{ind,eng}.traineddata.gz
 *
 * Core & worker diambil dari node_modules (tanpa jaringan). Model bahasa TIDAK
 * ikut paket npm, jadi diunduh sekali dari CDN yang sama seperti default
 * tesseract.js; bila unduhan gagal (mis. build offline), skrip hanya memberi
 * peringatan dan aplikasi otomatis kembali ke `langPath` CDN - build tidak
 * pernah gagal karena langkah opsional ini.
 *
 * Dijalankan otomatis lewat `prebuild`; manual: `npm run vendor:ocr`.
 */

import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/tesseract');
const langDir = join(outDir, 'lang');

/** Varian core yang dipakai: apa pun yang SIMD-capable memakai yang SIMD. */
const CORE_FILES = ['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'];
const LANGS = ['ind', 'eng'];
const LANG_CDN = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data';
const MIN_LANG_BYTES = 100_000;

const require = createRequire(import.meta.url);
const tesseractDir = dirname(require.resolve('tesseract.js/package.json'));
// Resolve core lewat tesseract.js sendiri agar versinya selalu cocok dengan
// yang diharapkan worker (bukan versi yang kebetulan ada di root node_modules).
const tjRequire = createRequire(require.resolve('tesseract.js/package.json'));
const coreDir = dirname(tjRequire.resolve('tesseract.js-core/package.json'));

mkdirSync(langDir, { recursive: true });

let bytes = 0;
const copy = (from, to) => {
  copyFileSync(from, to);
  bytes += statSync(to).size;
};

copy(join(tesseractDir, 'dist/worker.min.js'), join(outDir, 'worker.min.js'));
for (const file of CORE_FILES) copy(join(coreDir, file), join(outDir, file));
console.log(`vendor-tesseract: worker + ${CORE_FILES.length} varian core -> public/tesseract/`);

for (const lang of LANGS) {
  const dest = join(langDir, `${lang}.traineddata.gz`);
  if (existsSync(dest) && statSync(dest).size >= MIN_LANG_BYTES) {
    bytes += statSync(dest).size;
    console.log(`vendor-tesseract: ${lang} sudah ada (${(statSync(dest).size / 1024).toFixed(0)} KB), dilewati`);
    continue;
  }
  try {
    const res = await fetch(`${LANG_CDN}/${lang}/4.0.0_best_int/${lang}.traineddata.gz`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < MIN_LANG_BYTES) throw new Error(`ukuran ${buf.byteLength} B tidak wajar`);
    await writeFile(dest, buf);
    bytes += buf.byteLength;
    console.log(`vendor-tesseract: ${lang}.traineddata.gz -> ${(buf.byteLength / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.warn(`vendor-tesseract: gagal mengunduh model ${lang} (${e.message}) - OCR akan memakai langPath CDN`);
  }
}

console.log(`vendor-tesseract: total ${(bytes / 1024 / 1024).toFixed(1)} MB di public/tesseract/ (tidak di-precache)`);
