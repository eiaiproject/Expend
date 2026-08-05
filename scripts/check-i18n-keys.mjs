/**
 * i18n completeness check script.
 * Extracts all t('key') calls from src/ and verifies they exist in en.json and id.json.
 * Exit code 1 if any key is missing in either locale file.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
  // Indirect keys assigned to *Key props then passed to t(variable) —
  // e.g. labelKey/descLabelKey/nameKey/titleKey (Home/WalletDetail tx groups,
  // PayeeSortSheet, DEFAULT_CATEGORIES, schedule frequency cards).
  const indirectRe = /\b(?:labelKey|descLabelKey|nameKey|titleKey|descKey|frequencyKey|statusKey)\s*:\s*['"]([^'"]+?)['"]/g;
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    let match;
    while ((match = re.exec(content)) !== null) {
      keys.add(match[1]);
    }
    while ((match = indirectRe.exec(content)) !== null) {
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

if (!hasError) {
  console.log(`✅ i18n check passed: ${usedKeys.size} keys used, all present in en.json and id.json`);
}

process.exit(hasError ? 1 : 0);
