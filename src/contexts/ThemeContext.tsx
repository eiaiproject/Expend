import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../db/db';
import { THEME_META_COLORS } from '../utils/brandColors';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const setting = await db.settings.get('theme');
        if (setting?.value === 'light' || setting?.value === 'dark') {
          setThemeState(setting.value);
        }
      } catch (err) {
        console.error('Failed to load theme:', err);
      }
      setLoaded(true);
    };
    loadTheme();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
    // Update meta theme-color for browser/status bar
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === 'light' ? THEME_META_COLORS.light : THEME_META_COLORS.dark;
  }, [theme, loaded]);

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);
    await db.settings.put({ key: 'theme', value: newTheme });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
