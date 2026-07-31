/**
 * Release notes service (What's New).
 *
 * Powers the version-change popup that appears once when a returning user
 * opens the app after an update. The last app version the user acknowledged
 * is stored in db.settings; on each launch the dialog shows notes for every
 * released version newer than that one (newest first).
 *
 * - Brand-new users (no stored version) never see the popup — they just get
 *   the current version recorded silently.
 * - Dismissing the dialog records the current version so it is not shown
 *   again until the next release.
 */
import { db } from '../db/db';

// ── Data ────────────────────────────────────────────────────────────────

export interface ReleaseNote {
  /** Semver string, e.g. '1.13.0' (no leading 'v'). */
  version: string;
  /** i18n keys describing the user-facing changes in this version. */
  items: string[];
}

/**
 * Curated release notes, newest first. Each item is an i18n key so the
 * popup renders in both supported languages.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  { version: '1.13.2', items: ['whatsNew.1_13_2_1'] },
  { version: '1.13.1', items: ['whatsNew.1_13_1_1'] },
  {
    version: '1.13.0',
    items: [
      'whatsNew.1_13_0_1',
      'whatsNew.1_13_0_2',
      'whatsNew.1_13_0_3',
      'whatsNew.1_13_0_4',
      'whatsNew.1_13_0_5',
      'whatsNew.1_13_0_6',
      'whatsNew.1_13_0_7',
      'whatsNew.1_13_0_8',
      'whatsNew.1_13_0_9',
    ],
  },
];

// ── Version comparison ─────────────────────────────────────────────────

/** Numeric semver comparison. Returns -1, 0, or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

/**
 * Notes for versions strictly newer than `lastSeenVersion` and not newer
 * than `currentVersion`, newest first. Empty when there is nothing new.
 */
export function getReleaseNotesSince(
  lastSeenVersion: string | null,
  currentVersion: string,
): ReleaseNote[] {
  if (!lastSeenVersion) return [];
  return RELEASE_NOTES.filter(
    (note) =>
      compareVersions(note.version, lastSeenVersion) > 0 &&
      compareVersions(note.version, currentVersion) <= 0,
  ).sort((a, b) => compareVersions(b.version, a.version));
}

// ── Persistence ────────────────────────────────────────────────────────

const LAST_SEEN_VERSION_KEY = 'lastSeenAppVersion';

/** Read the last app version the user acknowledged, tolerating corrupt values. */
export async function getLastSeenVersion(): Promise<string | null> {
  try {
    const entry = await db.settings.get(LAST_SEEN_VERSION_KEY);
    return typeof entry?.value === 'string' ? entry.value : null;
  } catch {
    return null;
  }
}

/** Record that the user acknowledged `version`. */
export async function markVersionSeen(version: string): Promise<void> {
  try {
    await db.settings.put({ key: LAST_SEEN_VERSION_KEY, value: version });
  } catch {
    // Storage unavailable — popup must never crash the app shell.
  }
}
