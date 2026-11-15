import { useCallback, useEffect, useRef, useState } from 'react'
import { WifiOff, X } from 'lucide-react'
import { BottomNav, MobileBar, Sidebar, type View } from './components/AppNav'
import { ChatFeed } from './components/ChatFeed'
import { Composer } from './components/Composer'
import { Dashboard } from './components/Dashboard'
import { DraftDialog } from './components/DraftDialog'
import { ListView } from './components/ListView'
import { SettingsDialog } from './components/SettingsDialog'
import { TutorialDialog } from './components/TutorialDialog'
import { parseChat, type Draft } from './lib/chatParser'
import {
  createTransaction,
  deleteTransaction,
  requestPersistence,
  updateTransaction,
  type Transaction,
} from './lib/db'
import { cancelOcr, OcrFailure, readReceipt, type OcrPhase } from './lib/ocr'
import {
  applyTheme,
  getInitialThemePreference,
  systemTheme,
  type Theme,
  type ThemePreference,
} from './lib/theme'

interface DraftState {
  key: string
  mode: 'new' | 'edit'
  fromChat: boolean
  transaction?: Transaction
  draft: Draft
  imageUrl?: string | null
}

interface OcrState {
  progress: number
  fileName: string
  phase: OcrPhase
}

interface OcrErrorState {
  file: File
  fileName: string
  message: string
}

function viewFromLocation(): View {
  const hash = window.location.hash.replace(/^#/, '')
  return hash === 'daftar' || hash === 'dasbor' ? hash : 'catat'
}

function viewUrl(view: View): string {
  const base = `${window.location.pathname}${window.location.search}`
  return view === 'catat' ? base : `${base}#${view}`
}

export default function App() {
  const [view, setView] = useState<View>(() => viewFromLocation())
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    getInitialThemePreference(),
  )
  const [systemThemeValue, setSystemThemeValue] = useState<Theme>(() => systemTheme())
  const theme = themePreference === 'system' ? systemThemeValue : themePreference
  const [hideAmounts, setHideAmounts] = useState(() => {
    try {
      return localStorage.getItem('expend-hide-amounts') === '1'
    } catch {
      return false
    }
  })
  const [draftState, setDraftState] = useState<DraftState | null>(null)
  const [ocr, setOcr] = useState<OcrState | null>(null)
  const [ocrError, setOcrError] = useState<OcrErrorState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [composerReset, setComposerReset] = useState(0)
  const [focusComposer, setFocusComposer] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [swUpdate, setSwUpdate] = useState(false)
  const cancelled = useRef(false)
  const ocrRequest = useRef(0)
  const imageUrlRef = useRef<string | null>(null)
  const contentRef = useRef<HTMLElement>(null)
  const historyInitialized = useRef(false)

  useEffect(() => {
    applyTheme(themePreference, theme)
  }, [themePreference, theme])

  useEffect(() => {
    try {
      localStorage.setItem('expend-hide-amounts', hideAmounts ? '1' : '0')
    } catch {
      // Preferensi tetap berlaku untuk sesi ini.
    }
  }, [hideAmounts])

  useEffect(() => {
    const handleUpdate = () => setSwUpdate(true)
    window.addEventListener('expend:sw-update', handleUpdate)
    return () => window.removeEventListener('expend:sw-update', handleUpdate)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setSystemThemeValue(media.matches ? 'dark' : 'light')
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'expend-hide-amounts') {
        setHideAmounts(event.newValue === '1')
        return
      }
      if (event.key !== 'expend-theme') return
      setThemePreference(
        event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system',
      )
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const applyUpdate = async () => {
    const registration = await navigator.serviceWorker?.getRegistration()
    const waiting = registration?.waiting
    if (!waiting) {
      window.location.reload()
      return
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    })
    waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemePreference(next === systemThemeValue ? 'system' : next)
  }

  useEffect(() => {
    const state = window.history.state ?? {}
    if (!historyInitialized.current) {
      historyInitialized.current = true
      window.history.replaceState({ ...state, view }, '', viewUrl(view))
      return
    }
    if (state.view === view) return
    window.history.pushState({ ...state, view }, '', viewUrl(view))
  }, [view])

  useEffect(() => {
    const handlePop = (event: PopStateEvent) => {
      const next = event.state?.view
      setView(next === 'daftar' || next === 'dasbor' ? next : viewFromLocation())
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  useEffect(() => {
    if (view !== 'catat') contentRef.current?.scrollTo({ top: 0 })
  }, [view])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (highlightId === null) return
    const timer = window.setTimeout(() => setHighlightId(null), 1800)
    return () => window.clearTimeout(timer)
  }, [highlightId])

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const startOcr = useCallback(async (file: File) => {
    const request = ocrRequest.current + 1
    ocrRequest.current = request
    cancelled.current = false
    setView('catat')
    setOcrError(null)
    setOcr({
      progress: 0,
      fileName: file.name || 'bukti transfer',
      phase: 'Menyiapkan mesin OCR',
    })
    try {
      const result = await readReceipt(file, (progress, phase) => {
        if (ocrRequest.current !== request) return
        setOcr((current) => (current ? { ...current, progress, phase } : current))
      })
      if (cancelled.current || ocrRequest.current !== request) return
      const url = URL.createObjectURL(file)
      imageUrlRef.current = url
      setDraftState({
        key: crypto.randomUUID(),
        mode: 'new',
        fromChat: false,
        draft: {
          date: result.date,
          payee: result.payee,
          amount: result.amount,
          source: result.source,
          note: result.note,
          raw: result.raw,
          warnings: result.warnings,
        },
        imageUrl: url,
      })
    } catch (error) {
      if (!cancelled.current && ocrRequest.current === request) {
        setOcrError({
          file,
          fileName: file.name || 'bukti transfer',
          message:
            error instanceof OcrFailure && error.reason === 'engine'
              ? 'Mesin OCR gagal dimuat. Periksa koneksi, lalu coba lagi.'
              : 'Teks pada gambar tidak bisa dibaca. Coba foto yang lebih jelas atau isi manual.',
        })
      }
    } finally {
      if (ocrRequest.current === request) setOcr(null)
    }
  }, [])

  useEffect(() => {
    if (!('caches' in window)) return
    if (new URLSearchParams(window.location.search).get('shared') !== '1') return
    window.history.replaceState(null, '', '/')
    void (async () => {
      try {
        const cache = await caches.open('expend-share')
        const response = await cache.match('/shared-receipt')
        if (!response) return
        const blob = await response.blob()
        await cache.delete('/shared-receipt')
        const filename = decodeURIComponent(
          response.headers.get('x-filename') ?? 'bukti-transfer.jpg',
        )
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
        await startOcr(file)
      } catch {
        setToast('Bukti transfer dari aplikasi lain tidak bisa dibaca.')
      }
    })()
  }, [startOcr])

  const closeDraft = useCallback(() => {
    setDraftState(null)
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current)
      imageUrlRef.current = null
    }
  }, [])

  const openChatDraft = (text: string) => {
    setDraftState({
      key: crypto.randomUUID(),
      mode: 'new',
      fromChat: true,
      draft: parseChat(text),
    })
  }

  const handleSave = async (draft: Draft) => {
    if (!draftState) return
    if (draftState.mode === 'edit' && draftState.transaction?.id != null) {
      await updateTransaction(draftState.transaction.id, {
        date: draft.date,
        payee: draft.payee,
        amount: draft.amount ?? 0,
        source: draft.source,
        note: draft.note,
      })
      setHighlightId(draftState.transaction.id)
      setToast('Perubahan disimpan.')
    } else {
      const saved = await createTransaction({
        date: draft.date,
        payee: draft.payee,
        amount: draft.amount ?? 0,
        source: draft.source,
        note: draft.note,
      })
      setHighlightId(saved.id ?? null)
      setToast(`Transaksi ${saved.number} disimpan.`)
      if (draftState.fromChat) setComposerReset((value) => value + 1)
      void requestPersistence()
    }
  }

  const handleDelete = async () => {
    if (draftState?.transaction?.id == null) return
    await deleteTransaction(draftState.transaction.id)
    setHighlightId(null)
    setToast(`Transaksi ${draftState.transaction.number} dihapus. Nomornya bisa dipakai lagi.`)
  }

  const handleEdit = (transaction: Transaction) => {
    setDraftState({
      key: crypto.randomUUID(),
      mode: 'edit',
      fromChat: false,
      transaction,
      draft: {
        date: transaction.date,
        payee: transaction.payee,
        amount: transaction.amount,
        source: transaction.source,
        note: transaction.note,
        raw: '',
        warnings: [],
      },
    })
  }

  const handleCancelOcr = () => {
    ocrRequest.current += 1
    cancelled.current = true
    setOcr(null)
    void cancelOcr()
  }

  const retryOcr = () => {
    if (ocrError) void startOcr(ocrError.file)
  }

  return (
    <div className="app">
      <a className="skip" href="#main">
        Lewati ke konten
      </a>

      <Sidebar
        view={view}
        onView={setView}
        theme={theme}
        onToggleTheme={toggleTheme}
        hideAmounts={hideAmounts}
        onToggleAmounts={() => setHideAmounts((value) => !value)}
        onOpenTutorial={() => setTutorialOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="screen">
        <MobileBar
          theme={theme}
          onToggleTheme={toggleTheme}
          hideAmounts={hideAmounts}
          onToggleAmounts={() => setHideAmounts((value) => !value)}
          onOpenTutorial={() => setTutorialOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {!online ? (
          <div className="offline" role="status">
            <WifiOff size={14} strokeWidth={1.75} aria-hidden="true" />
            Offline. Data tetap tersimpan.
          </div>
        ) : null}

        {swUpdate ? (
          <div className="update-banner" role="status">
            <span>Versi baru Expend tersedia.</span>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => void applyUpdate()}
            >
              Muat ulang
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSwUpdate(false)}
              aria-label="Tutup pemberitahuan versi baru"
            >
              <X size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <main id="main" className="content" ref={contentRef}>
          {view === 'catat' ? (
            <ChatFeed
              onEdit={handleEdit}
              onViewAll={() => setView('daftar')}
              highlightId={highlightId}
              hideAmounts={hideAmounts}
            />
          ) : null}
          {view === 'daftar' ? (
            <ListView onEdit={handleEdit} hideAmounts={hideAmounts} />
          ) : null}
          {view === 'dasbor' ? (
            <Dashboard
              hideAmounts={hideAmounts}
              onGoToComposer={() => {
                setView('catat')
                setFocusComposer(true)
              }}
            />
          ) : null}
        </main>

        {view === 'catat' ? (
          <Composer
            onSubmit={openChatDraft}
            onUpload={startOcr}
            ocr={ocr}
            onCancelOcr={handleCancelOcr}
            ocrError={ocrError}
            onRetryOcr={retryOcr}
            onDismissOcrError={() => setOcrError(null)}
            resetToken={composerReset}
            focusRequest={focusComposer}
            onFocusHandled={() => setFocusComposer(false)}
            hideAmounts={hideAmounts}
          />
        ) : null}

        <BottomNav view={view} onView={setView} />
      </div>

      {draftState ? (
        <DraftDialog
          key={draftState.key}
          mode={draftState.mode}
          initial={draftState.draft}
          transaction={draftState.transaction}
          imageUrl={draftState.imageUrl}
          hideAmounts={hideAmounts}
          onClose={closeDraft}
          onSave={handleSave}
          onDelete={draftState.mode === 'edit' ? handleDelete : undefined}
        />
      ) : null}

      {tutorialOpen ? <TutorialDialog onClose={() => setTutorialOpen(false)} /> : null}

      {settingsOpen ? (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          onNotify={setToast}
          theme={theme}
          themePreference={themePreference}
          onTheme={setThemePreference}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
