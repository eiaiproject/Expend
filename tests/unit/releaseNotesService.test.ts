/**
 * Unit tests for the release notes service (What's New popup).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import {
  RELEASE_NOTES,
  compareVersions,
  getLastSeenVersion,
  getReleaseNotesSince,
  markVersionSeen,
} from '../../src/services/releaseNotesService';

beforeEach(async () => {
  await db.settings.clear();
});

describe('compareVersions', () => {
  it('compares numeric semver parts correctly', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.13.2', '1.13.2')).toBe(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });

  it('treats missing parts as zero', () => {
    expect(compareVersions('1.13', '1.13.0')).toBe(0);
    expect(compareVersions('1.13', '1.13.1')).toBe(-1);
  });
});

describe('getReleaseNotesSince', () => {
  it('returns notes for versions newer than the last seen one', () => {
    const notes = getReleaseNotesSince('1.12.0', '1.13.2');
    expect(notes.length).toBeGreaterThan(0);
    // Newest first
    expect(notes[0]!.version).toBe('1.13.2');
    const versions = notes.map((n) => n.version);
    expect(versions).toEqual([...versions].sort(compareVersions).reverse());
    // All returned versions are strictly newer than last seen
    for (const note of notes) {
      expect(compareVersions(note.version, '1.12.0')).toBeGreaterThan(0);
    }
  });

  it('returns nothing when already on the latest version', () => {
    expect(getReleaseNotesSince('1.13.2', '1.13.2')).toEqual([]);
  });

  it('returns nothing when the stored version is newer than current', () => {
    expect(getReleaseNotesSince('1.14.0', '1.13.2')).toEqual([]);
  });

  it('returns nothing for brand-new users without a stored version', () => {
    expect(getReleaseNotesSince(null, '1.13.2')).toEqual([]);
  });

  it('caps notes at the current version', () => {
    const notes = getReleaseNotesSince('1.0.0', '1.13.1');
    for (const note of notes) {
      expect(compareVersions(note.version, '1.13.1')).toBeLessThanOrEqual(0);
    }
  });
});

describe('last seen version persistence', () => {
  it('returns null initially', async () => {
    expect(await getLastSeenVersion()).toBeNull();
  });

  it('stores and reads back the acknowledged version', async () => {
    await markVersionSeen('1.13.2');
    expect(await getLastSeenVersion()).toBe('1.13.2');
  });

  it('overwrites a previous version', async () => {
    await markVersionSeen('1.13.0');
    await markVersionSeen('1.13.2');
    expect(await getLastSeenVersion()).toBe('1.13.2');
  });

  it('handles corrupt stored values gracefully', async () => {
    await db.settings.put({ key: 'lastSeenAppVersion', value: 42 });
    expect(await getLastSeenVersion()).toBeNull();
  });
});

describe('release notes i18n completeness', () => {
  it('every note item key exists in both en and id locales', async () => {
    const { default: en } = await import('../../src/i18n/locales/en.json');
    const { default: id } = await import('../../src/i18n/locales/id.json');
    const enKeys = new Set(Object.keys(en.translation));
    const idKeys = new Set(Object.keys(id.translation));
    const missing: string[] = [];
    for (const note of RELEASE_NOTES) {
      for (const item of note.items) {
        if (!enKeys.has(item) || !idKeys.has(item)) missing.push(item);
      }
    }
    expect(missing).toEqual([]);
  });
});
