/**
 * read-commit.mjs
 *
 * Baca SHA commit HEAD langsung dari `.git` memakai `fs` saja.
 * Alasan: Sonar typescript:S4036 melarang `child_process.exec*` karena
 * resolusi biner lewat `PATH` rawan hijack; membaca file git murni
 * menghilangkan vektor itu. Dipakai `vite.config.ts` untuk metadata
 * build per-commit (`__APP_COMMIT__`).
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function resolveGitDir(root) {
  const dotGit = resolve(root, '.git');
  try {
    if (statSync(dotGit).isFile()) {
      // Worktree: `.git` berisi pointer `gitdir: <path>` (tanpa regex: S8786)
      const pointer = readFileSync(dotGit, 'utf8').trim();
      const prefix = 'gitdir:';
      if (pointer.startsWith(prefix)) return resolve(root, pointer.slice(prefix.length).trim());
    }
  } catch {}
  return dotGit;
}

export function readGitCommit(root = process.cwd()) {
  try {
    const gitDir = resolveGitDir(root);
    let head = readFileSync(resolve(gitDir, 'HEAD'), 'utf8').trim();
    if (head.startsWith('ref:')) {
      const ref = head.slice(4).trim();
      const refPath = resolve(gitDir, ref);
      if (existsSync(refPath)) {
        head = readFileSync(refPath, 'utf8').trim();
      } else {
        // Ref terkompresi (packed-refs) setelah gc/clone
        const packed = readFileSync(resolve(gitDir, 'packed-refs'), 'utf8');
        const line = packed.split('\n').find((l) => l.endsWith(` ${ref}`));
        if (!line) return 'dev';
        head = line.split(' ')[0];
      }
    }
    return /^[0-9a-f]{40}$/i.test(head) ? head.slice(0, 7) : 'dev';
  } catch {
    return 'dev';
  }
}
