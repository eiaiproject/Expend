import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../db/db';

type Theme = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';
const THEME_META_COLORS = { light: '#F2F4EE', dark: '#1A1E16' } as const;

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === 'light') {
    root.dataset.theme = 'light';
  } else {
    delete root.dataset.theme;
  }
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = resolved === 'light' ? THEME_META_COLORS.light : THEME_META_COLORS.dark;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [loaded, setLoaded] = useState(false);
  const resolvedTheme: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const setting = await db.settings.get('theme');
        if (setting?.value === 'light' || setting?.value === 'dark' || setting?.value === 'system') {
          setThemeState(setting.value);
        }
      } catch { /* ignore */ }
      setLoaded(true);
    };
    loadTheme();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    applyTheme(resolvedTheme);
  }, [resolvedTheme, loaded]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme(getSystemTheme());
    try {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } catch {
      (mq as MediaQueryList & { addListener: (fn: EventListener) => void }).addListener(handler as EventListener);
      return () => (mq as MediaQueryList & { removeListener: (fn: EventListener) => void }).removeListener(handler as EventListener);
    }
  }, [theme]);

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);
    await db.settings.put({ key: 'theme', value: newTheme });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
