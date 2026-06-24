/**
 * i18n completeness check script.
 * Extracts all t('key') calls from src/ and verifies they exist in en.json and id.json.
 * Exit code 1 if any key is missing in either locale file.
 */
import { readFileSync } from 'fs';
import { globSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

function getAllTsFiles(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function extractKeys(files) {
  const keys = new Set();
  // Match t('...') and t("...") — non-greedy
  const re = /\bt\(\s*['"]([^'"]+?)['"]\s*[,)]/g;
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    let match;
    while ((match = re.exec(content)) !== null) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function loadLocaleKeys(path) {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  return new Set(Object.keys(raw.translation || {}));
}

const srcDir = new URL('../src', import.meta.url).pathname;
const enPath = new URL('../src/i18n/locales/en.json', import.meta.url).pathname;
const idPath = new URL('../src/i18n/locales/id.json', import.meta.url).pathname;

const files = getAllTsFiles(srcDir);
const usedKeys = extractKeys(files);
const enKeys = loadLocaleKeys(enPath);
const idKeys = loadLocaleKeys(idPath);

const missingEn = [];
const missingId = [];
for (const key of usedKeys) {
  if (!enKeys.has(key)) missingEn.push(key);
  if (!idKeys.has(key)) missingId.push(key);
}

// Check for stale keys (in locale but not used)
const staleEn = [];
const staleId = [];
for (const key of enKeys) {
  if (!usedKeys.has(key)) staleEn.push(key);
}
for (const key of idKeys) {
  if (!usedKeys.has(key)) staleId.push(key);
}

let hasError = false;

if (missingEn.length > 0) {
  console.error(`❌ Missing ${missingEn.length} key(s) in en.json:`);
  for (const k of missingEn) console.error(`  - ${k}`);
  hasError = true;
}

if (missingId.length > 0) {
  console.error(`❌ Missing ${missingId.length} key(s) in id.json:`);
  for (const k of missingId) console.error(`  - ${k}`);
  hasError = true;
}

if (staleEn.length > 0) {
  console.log(`ℹ️  Stale (unused) ${staleEn.length} key(s) in en.json (informational):`);
  for (const k of staleEn.slice(0, 10)) console.log(`  - ${k}`);
  if (staleEn.length > 10) console.log(`  ... and ${staleEn.length - 10} more`);
}

if (staleId.length > 0) {
  console.log(`ℹ️  Stale (unused) ${staleId.length} key(s) in id.json (informational):`);
  for (const k of staleId.slice(0, 10)) console.log(`  - ${k}`);
  if (staleId.length > 10) console.log(`  ... and ${staleId.length - 10} more`);
}

if (!hasError) {
  console.log(`✅ i18n check passed: ${usedKeys.size} keys used, all present in en.json and id.json`);
}

process.exit(hasError ? 1 : 0);
