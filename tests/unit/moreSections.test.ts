import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MORE_SECTIONS } from '../../src/components/moreSections';

const locales = (['en', 'id'] as const).map((lang) => {
  const raw = readFileSync(resolve(process.cwd(), `src/i18n/locales/${lang}.json`), 'utf-8');
  return JSON.parse(raw)['translation'] as Record<string, string>;
});

describe('moreSections', () => {
  it('groups finance, data, application, and about in order', () => {
    expect(MORE_SECTIONS.map((s) => s.key)).toEqual(['finance', 'data', 'application', 'about']);
  });

  it('exposes every internal route through a `to` target', () => {
    const targets = MORE_SECTIONS.flatMap((s) => s.links).map((l) => l.to).filter(Boolean);
    expect(targets).toContain('/stats');
    expect(targets).toContain('/debts');
    expect(targets).toContain('/payees');
    expect(targets).toContain('/categories');
    expect(targets).toContain('/schedules');
  });

  it('does not duplicate the same feature route within one section', () => {
    for (const section of MORE_SECTIONS) {
      const routes = section.links.map((l) => l.to).filter(Boolean);
      const duplicates = routes.filter((r, i) => routes.indexOf(r) !== i);
      // Only Settings deep links may repeat (Backup & Restore + Import & Export).
      expect(duplicates.every((r) => r === '/settings')).toBe(true);
    }
  });

  it('has label keys present in both locale files', () => {
    for (const section of MORE_SECTIONS) {
      for (const link of section.links) {
        for (const key of [link.labelKey, link.descKey].filter((k): k is string => !!k)) {
          for (const dict of locales) {
            expect(dict, `${key} missing in locale`).toHaveProperty(key);
          }
        }
        expect(section.titleKey, `${section.titleKey} missing in locale`).toBeTruthy();
      }
      for (const dict of locales) {
        expect(dict, `${section.titleKey} missing in locale`).toHaveProperty(section.titleKey);
      }
    }
  });

  it('keeps management features out of Settings duplication', () => {
    const financeRoutes = MORE_SECTIONS.find((s) => s.key === 'finance')!.links.map((l) => l.to);
    // Feature routes must be direct links, not Settings deep links.
    for (const route of ['/categories', '/payees', '/schedules']) {
      expect(financeRoutes).toContain(route);
    }
  });
});
