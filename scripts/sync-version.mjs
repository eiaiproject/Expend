#!/usr/bin/env node
/**
 * sync-version.mjs
 *
 * Runs as the npm `version` lifecycle hook (after package.json is bumped,
 * before the release commit + tag). Keeps every project-wide version
 * reference in sync automatically:
 *
 *   1. README.md  - shields.io version badge
 *   2. CHANGELOG.md - prepends a new entry built from Conventional Commits
 *                     between the previous version tag and HEAD
 *
 * package.json + package-lock.json are already bumped by `npm version`.
 *
 * Usage (manual): `node scripts/sync-version.mjs [fromTag]`
 *   fromTag defaults to the latest git tag (`git describe --tags --abbrev=0`).
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = pkg.version;
if (!version) {
  console.error('sync-version: no version found in package.json');
  process.exit(1);
}

// --- 1. README badge -------------------------------------------------------
const readmePath = resolve(root, 'README.md');
let readme = readFileSync(readmePath, 'utf8');
const badgeRe = /(img\.shields\.io\/badge\/version-)[0-9]+\.[0-9]+\.[0-9]+(-teal)?/;
if (!badgeRe.test(readme)) {
  console.warn('sync-version: README version badge not found, skipping');
} else {
  readme = readme.replace(badgeRe, `$1${version}-teal`);
  writeFileSync(readmePath, readme);
  console.log(`sync-version: README badge -> ${version}`);
}

// --- 2. CHANGELOG entry ----------------------------------------------------
const changelogPath = resolve(root, 'CHANGELOG.md');
const date = new Date().toISOString().slice(0, 10);

const fromTag = process.argv[2] || (() => {
  try {
    return execSync('git describe --tags --abbrev=0', { cwd: root }).toString().trim(); // NOSONAR — S4036: no user input
  } catch {
    return '';
  }
})();

const range = fromTag ? `${fromTag}..HEAD` : 'HEAD';
let commits = [];
try {
  commits = execSync(`git log ${range} --no-merges --pretty=format:%s`, { cwd: root })
    .toString()
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
} catch {
  commits = [];
}

// Conventional Commits: type(scope): subject  (or type: subject)
const SECTION = {
  feat: 'Added',
  fix: 'Fixed',
  perf: 'Performance',
  refactor: 'Changed',
};
// Internal-only types excluded from the user-facing changelog.
const SKIP = new Set(['docs', 'chore', 'ci', 'test', 'build', 'style']);

const grouped = {};
for (const c of commits) {
  const m = c.match(/^(\w+)(\([^)]*\))?:\s*(.*)$/);
  if (!m) continue;
  const type = m[1].toLowerCase();
  if (SKIP.has(type)) continue;
  const section = SECTION[type] || 'Changed';
  const subject = m[3].replace(/\.$/, '');
  const cap = subject.charAt(0).toUpperCase() + subject.slice(1);
  if (!grouped[section]) grouped[section] = [];
  grouped[section].push(cap);
}

const ORDER = ['Added', 'Changed', 'Performance', 'Fixed'];
let body = '';
for (const sec of ORDER) {
  if (!grouped[sec]?.length) continue;
  body += `\n### ${sec}\n\n`;
  for (const item of grouped[sec]) body += `- ${item}\n`;
}

const entry = `\n## ${version} - ${date}${body}\n`;

let changelog = readFileSync(changelogPath, 'utf8');
// Insert right after the top "# Changelog" heading block.
const insertAt = changelog.indexOf('\n## ');
if (insertAt === -1) {
  changelog = changelog.trimEnd() + entry;
} else {
  changelog = changelog.slice(0, insertAt) + entry + changelog.slice(insertAt);
}
writeFileSync(changelogPath, changelog);
console.log(`sync-version: CHANGELOG entry -> ${version} (${fromTag || 'initial'}..HEAD)`);

// Stage synced files so `npm version` includes them in the release commit.
try {
  execSync(`git add ${readmePath} ${changelogPath}`, { cwd: root, stdio: 'ignore' });
} catch {
  /* non-fatal: caller may stage manually */
}
