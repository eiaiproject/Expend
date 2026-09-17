import { describe, it, expect, beforeEach } from 'vitest';
import { isOnboarded, markOnboarded, clearOnboarded, ONBOARDED_KEY } from '../../src/utils/onboarding';
import { getFontSize, setFontSize, isHighContrast, setHighContrast, applyA11yPrefs } from '../../src/utils/a11yPrefs';
import { intervalDueDays, isBackupDueWithInterval } from '../../src/utils/backup';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.fontsize;
  delete document.documentElement.dataset.contrast;
});

describe('onboarding flag', () => {
  it('first-run false until marked', () => {
    expect(isOnboarded()).toBe(false);
    markOnboarded();
    expect(isOnboarded()).toBe(true);
    expect(localStorage.getItem(ONBOARDED_KEY)).toBe('1');
    clearOnboarded();
    expect(isOnboarded()).toBe(false);
  });
});

describe('a11y prefs persist + apply', () => {
  it('fontsize defaults m, persists s/m/l to <html>', () => {
    expect(getFontSize()).toBe('m');
    setFontSize('l');
    expect(getFontSize()).toBe('l');
    expect(document.documentElement.dataset.fontsize).toBe('l');
    setFontSize('s');
    expect(document.documentElement.dataset.fontsize).toBe('s');
  });

  it('high contrast toggles data-contrast', () => {
    expect(isHighContrast()).toBe(false);
    setHighContrast(true);
    expect(isHighContrast()).toBe(true);
    expect(document.documentElement.dataset.contrast).toBe('high');
    applyA11yPrefs();
    setHighContrast(false);
    expect(document.documentElement.dataset.contrast).toBeUndefined();
  });
});

describe('backup interval (default weekly)', () => {
  const NOW = Date.parse('2026-09-13T00:00:00.000Z');
  it('interval mapping weekly=7 monthly=30 off=null', () => {
    expect(intervalDueDays('weekly')).toBe(7);
    expect(intervalDueDays('monthly')).toBe(30);
    expect(intervalDueDays('off')).toBeNull();
  });

  it('weekly due after 7d, monthly not yet; off never', () => {
    const eightDaysAgo = new Date(NOW - 8 * 86_400_000).toISOString();
    expect(isBackupDueWithInterval(5, eightDaysAgo, 'weekly', NOW)).toBe(true);
    expect(isBackupDueWithInterval(5, eightDaysAgo, 'monthly', NOW)).toBe(false);
    expect(isBackupDueWithInterval(5, null, 'off', NOW)).toBe(false);
    expect(isBackupDueWithInterval(0, null, 'weekly', NOW)).toBe(false);
  });
});
