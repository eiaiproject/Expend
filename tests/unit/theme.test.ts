import { describe, it, expect, beforeEach } from 'vitest';
import { getTheme, setStoredTheme, applyTheme, nextTheme } from '../../src/utils/theme';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('theme prefs', () => {
  it('defaults to system, cycles system→light→dark→system', () => {
    expect(getTheme()).toBe('system');
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });

  it('setStoredTheme persists and applies data-theme', () => {
    setStoredTheme('dark');
    expect(getTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    setStoredTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    setStoredTheme('system');
    expect(getTheme()).toBe('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('applyTheme reflects stored value (boot path)', () => {
    localStorage.setItem('theme', 'dark');
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('ignores corrupt stored value', () => {
    localStorage.setItem('theme', 'neon');
    expect(getTheme()).toBe('system');
  });
});
