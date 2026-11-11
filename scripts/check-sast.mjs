#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }) // NOSONAR - S4036: no user input, git comes from the controlled CI PATH
  .split('\0')
  .filter(Boolean)
  .filter((p) => p.startsWith('src/') || p.startsWith('public/') || p.startsWith('scripts/'));

// Wordmark menyisipkan SVG statis yang dibangun di modul ini, bukan input pengguna.
// Scanner ini mendefinisikan pola, jadi teks aturannya sendiri bukan temuan.
const ALLOW = new Set(['src/components/Wordmark.tsx', 'scripts/check-sast.mjs']);

const rules = [
  { name: 'eval', re: /\beval\s*\(/ },
  { name: 'new-function', re: /\bnew\s+Function\s*\(/ },
  { name: 'innerHTML', re: /\.innerHTML\s*=/ },
  { name: 'document-write', re: /document\.write\s*\(/ },
  { name: 'dangerous-html', re: /dangerouslySetInnerHTML/ },
];

let failed = false;
for (const file of files) {
  if (ALLOW.has(file)) continue;
  try {
    const text = readFileSync(file, 'utf8');
    for (const rule of rules) {
      if (rule.re.test(text)) {
        console.error(`check-sast: ${rule.name} terdeteksi di ${file}`);
        failed = true;
      }
    }
  } catch {
    // File biner tidak relevan untuk aturan sumber.
  }
}

if (failed) {
  console.error('check-sast: gagal. Ganti pola berbahaya atau tambahkan allowlist dengan alasan tertulis.');
  process.exit(1);
}
console.log(`check-sast: ${files.length} file sumber diperiksa, tidak ada pola berbahaya.`);
