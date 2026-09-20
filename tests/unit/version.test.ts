import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, EXPORT_FORMAT_VERSION } from '../../src/config/version';
import { toJSON } from '../../src/utils/export';

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const pkg = JSON.parse(read('package.json')) as { version: string };

/**
 * Semver diterapkan menyeluruh: `package.json` adalah satu-satunya yang
 * ditulis manusia, sisanya diturunkan otomatis (scripts/sync-version.mjs untuk
 * README + CHANGELOG, `define` untuk __APP_VERSION__). Test ini gagal begitu
 * salah satu turunan melenceng - mis. bump manual tanpa menjalankan hook
 * `npm version`.
 */
describe('versi aplikasi konsisten di seluruh project', () => {
  it('package.json memakai semver MAJOR.MINOR.PATCH', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
  });

  it('badge versi README mengikuti package.json', () => {
    expect(read('README.md')).toContain(`img.shields.io/badge/version-${pkg.version}-teal`);
  });

  it('entri CHANGELOG teratas mengikuti package.json', () => {
    const firstHeading = read('CHANGELOG.md')
      .split('\n')
      .find((line) => line.startsWith('## '));
    const parsed = /^## (\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2})$/.exec(firstHeading ?? '');
    expect(parsed).not.toBeNull();
    expect(parsed?.[1]).toBe(pkg.version);
  });

  it('UI membaca versi hasil build, bukan angka hardcode', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('ekspor JSON mencatat versi aplikasi dan versi skema terpisah', () => {
    expect(Number.isInteger(EXPORT_FORMAT_VERSION)).toBe(true);
    const payload = JSON.parse(toJSON([])) as { version: number; appVersion: string };
    expect(payload.version).toBe(EXPORT_FORMAT_VERSION);
    expect(payload.appVersion).toBe(pkg.version);
  });
});
