import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGitCommit } from '../../scripts/read-commit.mjs';

describe('readGitCommit (pengganti execSync, aman S4036)', () => {
  it('baca SHA dari .git/HEAD + ref', () => {
    expect(readGitCommit()).toMatch(/^([0-9a-f]{7}|dev)$/);
  });

  it('fallback dev bila bukan repo', () => {
    expect(readGitCommit('/tmp/pasti-bukan-repo-xyz')).toBe('dev');
  });

  it('baca ref terkompresi via packed-refs', () => {
    const root = mkdtempSync(join(tmpdir(), 'fake-repo-'));
    try {
      mkdirSync(join(root, '.git'), { recursive: true });
      writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
      writeFileSync(join(root, '.git', 'packed-refs'), '# pack-refs\n' + 'a'.repeat(40) + ' refs/heads/main\n');
      expect(readGitCommit(root)).toBe('a'.repeat(7));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
