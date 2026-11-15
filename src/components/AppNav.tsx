import {
  ChartColumn,
  CircleHelp,
  Eye,
  EyeOff,
  List,
  Moon,
  PenLine,
  Settings2,
  Sun,
} from 'lucide-react'
import type { Theme } from '../lib/theme'

export type View = 'catat' | 'daftar' | 'dasbor'

const TABS = [
  { id: 'catat', label: 'Catat', icon: PenLine },
  { id: 'daftar', label: 'Daftar', icon: List },
  { id: 'dasbor', label: 'Dasbor', icon: ChartColumn },
] as const

interface ChromeProps {
  view: View
  onView: (view: View) => void
  theme: Theme
  onToggleTheme: () => void
  hideAmounts: boolean
  onToggleAmounts: () => void
  onOpenTutorial: () => void
  onOpenSettings: () => void
}

export function Sidebar({
  view,
  onView,
  theme,
  onToggleTheme,
  hideAmounts,
  onToggleAmounts,
  onOpenTutorial,
  onOpenSettings,
}: ChromeProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand">expend</span>
        <span className="brand-note">Buku kas pribadi</span>
      </div>

      <nav className="side-nav" aria-label="Navigasi utama">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              className={`side-item ${view === tab.id ? 'is-active' : ''}`}
              aria-current={view === tab.id ? 'page' : undefined}
              onClick={() => onView(tab.id)}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-foot">
        <button type="button" className="side-action" onClick={onOpenTutorial}>
          <CircleHelp size={17} strokeWidth={1.75} aria-hidden="true" />
          <span>Tutorial pengisian</span>
        </button>
        <button
          type="button"
          className="side-action"
          onClick={onToggleAmounts}
          aria-pressed={hideAmounts}
        >
          {hideAmounts ? (
            <Eye size={17} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <EyeOff size={17} strokeWidth={1.75} aria-hidden="true" />
          )}
          <span>{hideAmounts ? 'Tampilkan nominal' : 'Sembunyikan nominal'}</span>
        </button>
        <button type="button" className="side-action" onClick={onToggleTheme}>
          {theme === 'dark' ? (
            <Sun size={17} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Moon size={17} strokeWidth={1.75} aria-hidden="true" />
          )}
          <span>{theme === 'dark' ? 'Mode terang' : 'Mode gelap'}</span>
        </button>
        <button type="button" className="side-action" onClick={onOpenSettings}>
          <Settings2 size={17} strokeWidth={1.75} aria-hidden="true" />
          <span>Pengaturan dan data</span>
        </button>
        <p className="sidebar-note">Data tersimpan di perangkat ini.</p>
      </div>
    </aside>
  )
}

export function MobileBar({
  theme,
  onToggleTheme,
  hideAmounts,
  onToggleAmounts,
  onOpenTutorial,
  onOpenSettings,
}: Omit<ChromeProps, 'view' | 'onView'>) {
  return (
    <header className="mobile-bar">
      <span className="brand">expend</span>
      <div className="mobile-actions">
        <button
          type="button"
          className={`icon-btn ${hideAmounts ? 'is-active' : ''}`}
          onClick={onToggleAmounts}
          aria-label={hideAmounts ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
          aria-pressed={hideAmounts}
          title={hideAmounts ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
        >
          {hideAmounts ? (
            <Eye size={19} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <EyeOff size={19} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenTutorial}
          aria-label="Buka tutorial"
          title="Tutorial pengisian"
        >
          <CircleHelp size={19} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Pakai mode terang' : 'Pakai mode gelap'}
          title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
        >
          {theme === 'dark' ? (
            <Sun size={19} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Moon size={19} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label="Pengaturan dan data"
          title="Pengaturan dan data"
        >
          <Settings2 size={19} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

export function BottomNav({ view, onView }: Pick<ChromeProps, 'view' | 'onView'>) {
  return (
    <nav className="bottom-nav" aria-label="Navigasi utama">
      {TABS.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            className={`bottom-tab ${view === tab.id ? 'is-active' : ''}`}
            aria-current={view === tab.id ? 'page' : undefined}
            onClick={() => onView(tab.id)}
          >
            <span className="bottom-icon">
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="bottom-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
