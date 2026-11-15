export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

const KEY = 'expend-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const THEME_COLOR: Record<Theme, string> = {
  light: '#F4F2ED',
  dark: '#111110',
}

export function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function getInitialThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage diblokir: pakai preferensi sistem.
  }
  return 'system'
}

export function applyTheme(preference: ThemePreference, theme: Theme): void {
  const meta = document.querySelector('meta[name="color-scheme"]')
  if (meta) meta.setAttribute('content', preference === 'system' ? 'light dark' : preference)
  const themeColor = document.querySelector('meta[name="theme-color"]')
  if (themeColor) themeColor.setAttribute('content', THEME_COLOR[theme])
  try {
    if (preference === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, preference)
  } catch {
    // Tema tetap berlaku untuk sesi ini meski tidak bisa disimpan.
  }
}
