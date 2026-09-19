#!/usr/bin/env node
/**
 * auto-release.mjs
 *
 * CI entrypoint for automatic Semver releases on merge to main
 * (see .github/workflows/release.yml).
 *
 * Versioning per commit (Conventional Commits):
 *   breaking (`!` after type/scope, or BREAKING CHANGE in body) -> MAJOR
 *     (capped to MINOR while the package major is still 0)
 *   feat   -> MINOR
 *   fix | perf | refactor | revert -> PATCH
 *   chore | docs | test | ci | style | build | ... -> no release
 *
 * Highest bump across commits since the last release wins. Release commits
 * (`chore(release): ...`) and merge commits never count. Nothing
 * release-worthy -> exit 0 without doing anything.
 *
 * Env:
 *   BASE_REF - override the range base (default: last commit touching
 *              CHANGELOG.md, same rule as scripts/sync-version.mjs).
 *   DRY_RUN=1 - print what would happen without running npm version/push.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PATCH_TYPES = new Set(['fix', 'perf', 'refactor', 'revert']);

/**
 * @param {string[]} messages - raw commit messages (%B), oldest or newest first, order irrelevant
 * @param {number} [currentMajor=0] - major of the current package version
 * @returns {'major' | 'minor' | 'patch' | null}
 */
/** Bobot bump: tanpa ternary bersarang (S3358). */
const BUMP_RANK = { major: 3, minor: 2, patch: 1 };
export function determineBump(messages, currentMajor = 0) {
  const rank = (b) => BUMP_RANK[b] ?? 0;
  let bump = null;
  const consider = (b) => {
    if (b && rank(b) > rank(bump)) bump = b;
  };
  for (const raw of messages) {
    const msg = raw.trim();
    if (!msg || msg.startsWith('chore(release):') || msg.startsWith('Merge ')) continue;
    const subject = msg.split('\n', 1)[0];
    const m = /^(\w+)(?:\([^)]*\))?(!)?:/.exec(subject);
    if (!m) continue;
    const type = m[1];
    if (m[2] || /BREAKING CHANGE:/.test(msg)) {
      consider(currentMajor === 0 ? 'minor' : 'major');
    } else if (type === 'feat') {
      consider('minor');
    } else if (PATCH_TYPES.has(type)) {
      consider('patch');
    }
  }
  return bump;
}

// S4036: jangan andalkan resolusi PATH — npm terinstal di direktori yang
// sama dengan node (setup-node maupun lokal), jadi panggil absolut.
const NPM_BIN = join(dirname(process.execPath), `npm${process.platform === 'win32' ? '.cmd' : ''}`);

function sh(cmd) {
  // NOSONAR - S4721: no user input; range comes from git history or BASE_REF set in CI
  return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
}

function commitsSince(base) {
  const range = base ? `${base}..HEAD` : 'HEAD';
  // NOSONAR - S4721: range is a git SHA (or empty), never end-user input
  const out = sh(`git log ${range} --format=%B%x1e`);
  return out.split('\x1e');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const base =
    process.env.BASE_REF ||
    (() => {
      try {
        return sh('git log --format=%H -1 -- CHANGELOG.md');
      } catch {
        return '';
      }
    })();
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const currentMajor = Number(String(pkg.version).split('.')[0] ?? 0);
  const bump = determineBump(commitsSince(base), currentMajor);
  if (!bump) {
    console.log('auto-release: no release-worthy commits since last release, skipping');
    process.exit(0);
  }
  if (process.env.DRY_RUN) {
    console.log(`auto-release: would bump ${bump} (current ${pkg.version})`);
    process.exit(0);
  }
  execSync(`"${NPM_BIN}" version ${bump} -m "chore(release): %s"`, { cwd: root, stdio: 'inherit' });
  execSync('git push origin HEAD:refs/heads/main --follow-tags', { cwd: root, stdio: 'inherit' });
  console.log(`auto-release: released with ${bump} bump`);
}
