#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const MAX_BYTES = 1_000_000;
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((p) => !p.startsWith('tests/') && !p.startsWith('docs/') && !p.endsWith('package-lock.json'));

const rules = [
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'stripe-live-key', re: /\bsk_live_[0-9A-Za-z]{20,}\b/ },
  { name: 'generic-assignment', re: /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*['"][A-Za-z0-9_./+=-]{20,}['"]/i },
];

let failed = false;
for (const file of files) {
  try {
    if (statSync(file).size > MAX_BYTES) continue;
    const text = readFileSync(file, 'utf8');
    for (const rule of rules) {
      if (rule.re.test(text)) {
        console.error(`check-secrets: ${rule.name} terdeteksi di ${file}`);
        failed = true;
      }
    }
  } catch {
    // File biner atau tidak terbaca: lewati, bukan alasan menggagalkan scan.
  }
}

if (failed) {
  console.error('check-secrets: gagal. Hapus secret dari file dan riwayat, lalu rotasi kredensial.');
  process.exit(1);
}
console.log(`check-secrets: ${files.length} file diperiksa, tidak ada secret yang cocok.`);
