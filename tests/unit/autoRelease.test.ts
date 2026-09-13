import { describe, it, expect } from 'vitest';
import { determineBump } from '@scripts/auto-release.mjs';

describe('determineBump (auto-release versioning)', () => {
  it('returns null when nothing is release-worthy', () => {
    expect(determineBump(['chore: tidy', 'docs: readme', 'test: add case'])).toBeNull();
    expect(determineBump(['Merge pull request #33 from x'])).toBeNull();
    expect(determineBump(['chore(release): 0.16.1'])).toBeNull();
    expect(determineBump([])).toBeNull();
  });

  it('maps fix, perf, refactor and revert to patch', () => {
    expect(determineBump(['fix: typo'])).toBe('patch');
    expect(determineBump(['perf: faster parse'])).toBe('patch');
    expect(determineBump(['refactor(scope): dedupe'])).toBe('patch');
    expect(determineBump(['revert: feat x'])).toBe('patch');
  });

  it('maps feat to minor and lets it win over patch', () => {
    expect(determineBump(['feat: x'])).toBe('minor');
    expect(determineBump(['fix: y', 'feat: x', 'refactor: z'])).toBe('minor');
  });

  it('caps breaking to minor on 0.x, major otherwise', () => {
    expect(determineBump(['refactor!: drop Excel export'], 0)).toBe('minor');
    expect(determineBump(['refactor!: drop Excel export'], 1)).toBe('major');
    expect(determineBump(['feat: x\n\nBREAKING CHANGE: removes y'], 0)).toBe('minor');
    expect(determineBump(['feat: x\n\nBREAKING CHANGE: removes y'], 2)).toBe('major');
  });

  it('ignores non-conventional subjects', () => {
    expect(determineBump(['wip stuff', 'update'])).toBeNull();
  });
});
