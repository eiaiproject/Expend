#!/usr/bin/env node
/**
 * vendor-tesseract.mjs
 *
 * Menyalin aset OCR ke `public/tesseract/` supaya worker + core + model bahasa
 * disajikan dari origin sendiri, bukan dari CDN pihak ketiga.
 *
 * Core & worker diambil dari node_modules (tanpa jaringan). Model bahasa tidak
 * ikut paket npm dan diunduh sekali dari CDN. Setiap model diverifikasi dengan
 * SHA-256. Di CI (`CI=true`) atau saat `REQUIRE_OCR_ASSETS=1`, kegagalan unduh
 * atau checksum menghentikan build; di mesin lokal tanpa jaringan, skrip hanya
 * memberi peringatan dan aplikasi kembali ke `langPath` CDN.
 */

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
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
const REQUIRE_ASSETS = process.env.CI === 'true' || process.env.REQUIRE_OCR_ASSETS === '1';

const LANG_SHA256 = {
  ind: 'a8896d2f584a5baae73d658b86b765acc7b15b7ba05e014f62b1a2a23b699a91',
  eng: '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91',
};

const require = createRequire(import.meta.url);
const tesseractDir = dirname(require.resolve('tesseract.js/package.json'));
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

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function hasValidExisting(dest, expected) {
  if (!existsSync(dest) || statSync(dest).size < MIN_LANG_BYTES) return false;
  return sha256(readFileSync(dest)) === expected;
}

/** Unduh satu model bahasa; verifikasi checksum sebelum menulis. */
async function fetchLang(lang) {
  const dest = join(langDir, `${lang}.traineddata.gz`);
  const expected = LANG_SHA256[lang];
  if (hasValidExisting(dest, expected)) {
    console.log(`vendor-tesseract: ${lang} sudah ada dan checksum cocok, dilewati`);
    return statSync(dest).size;
  }
  if (existsSync(dest)) {
    console.warn(`vendor-tesseract: checksum ${lang} tidak cocok, file lama dihapus`);
    rmSync(dest, { force: true });
  }
  try {
    const res = await fetch(`${LANG_CDN}/${lang}/4.0.0_best_int/${lang}.traineddata.gz`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < MIN_LANG_BYTES) throw new Error(`ukuran ${buf.byteLength} B tidak wajar`);
    const actual = sha256(buf);
    if (actual !== expected) throw new Error(`checksum mismatch: ${actual}`);
    await writeFile(dest, buf);
    console.log(`vendor-tesseract: ${lang}.traineddata.gz -> ${(buf.byteLength / 1024).toFixed(0)} KB`);
    return buf.byteLength;
  } catch (e) {
    if (REQUIRE_ASSETS) throw new Error(`model ${lang} wajib tersedia: ${e.message}`);
    console.warn(`vendor-tesseract: gagal mengunduh model ${lang} (${e.message}) - OCR akan memakai langPath CDN`);
    return 0;
  }
}

let failed = false;
const results = await Promise.allSettled(LANGS.map(fetchLang));
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  if (result.status === 'fulfilled') {
    bytes += result.value;
  } else {
    failed = true;
    console.error(`vendor-tesseract: ${LANGS[i]}: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
  }
}

console.log(`vendor-tesseract: total ${(bytes / 1024 / 1024).toFixed(1)} MB di public/tesseract/ (tidak di-precache)`);
if (failed) {
  console.error('vendor-tesseract: aset OCR tidak lengkap; build dihentikan karena CI/REQUIRE_OCR_ASSETS.');
  process.exitCode = 1;
}
