/**
 * Gagal bila ada em dash (U+2014) di prosa atau komentar.
 *
 * Satu pengecualian: em dash di dalam kelas karakter regex, misalnya
 * `[-\u2013\u2014]`, karena di sana karakter itu bagian dari sintaks, bukan
 * tanda baca. Jalankan lewat `npm run lint:prose`; CI memanggilnya bersama lint.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const EM_DASH = '\u2014';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['src', 'tests', 'docs', 'scripts', '.github'];
const FILES = ['README.md', 'CHANGELOG.md', 'index.html'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report', '.git', 'public']);
const TEXT_FILE = /\.(?:[cm]?[jt]sx?|css|md|json|ya?ml|html)$/;
const REGEX_CHAR_CLASS = new RegExp(String.raw`\[[^\]\n]*${EM_DASH}[^\]\n]*\]`);

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (TEXT_FILE.test(name)) files.push(full);
  }
}

for (const dir of DIRS) {
  const full = join(ROOT, dir);
  try {
    if (statSync(full).isDirectory()) walk(full);
  } catch {
    // Direktori opsional (misalnya .github di salinan lokal) boleh tidak ada.
  }
}
for (const file of FILES) {
  const full = join(ROOT, file);
  try {
    if (statSync(full).isFile()) files.push(full);
  } catch {
    // Berkas opsional.
  }
}

const hits = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const [i, line] of lines.entries()) {
    if (line.includes(EM_DASH) && !REGEX_CHAR_CLASS.test(line)) {
      hits.push(`${relative(ROOT, file)}:${i + 1}`);
    }
  }
}

if (hits.length > 0) {
  console.error('Em dash ditemukan. Ganti dengan koma, titik, titik dua, atau tanda kurung:');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log('Prosa bersih: tidak ada em dash di luar kelas karakter regex.');
