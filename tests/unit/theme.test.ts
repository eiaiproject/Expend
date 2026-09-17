import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTheme, setStoredTheme, applyTheme, nextTheme, migrateLegacyTheme } from '../../src/utils/theme';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

describe('theme prefs (light/dark, default dark)', () => {
  it('defaults to dark, toggles light<->dark', () => {
    expect(getTheme()).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });

  it('setStoredTheme persists and applies data-theme', () => {
    setStoredTheme('dark');
    expect(getTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    setStoredTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('migrates legacy system/unset from OS once and persists', () => {
    localStorage.setItem('theme', 'system');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    migrateLegacyTheme();
    expect(localStorage.getItem('theme')).toBe('light');
    localStorage.setItem('theme', 'system');
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    migrateLegacyTheme();
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('migration keeps explicit choice and falls back dark without matchMedia', () => {
    localStorage.setItem('theme', 'light');
    migrateLegacyTheme();
    expect(localStorage.getItem('theme')).toBe('light');
    localStorage.clear();
    vi.stubGlobal('matchMedia', undefined);
    migrateLegacyTheme();
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('ignores corrupt stored value', () => {
    localStorage.setItem('theme', 'neon');
    expect(getTheme()).toBe('dark');
  });
});
