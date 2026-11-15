import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AlertCircle, Database, Download, Moon, Sun, Upload, X } from 'lucide-react'
import {
  getSortedTransactions,
  replaceAllTransactions,
  requestPersistence,
  storageEstimate,
  type TransactionInput,
} from '../lib/db'
import { downloadCsv, parseCsv } from '../lib/csv'
import { todayWIB } from '../lib/date'
import type { Theme, ThemePreference } from '../lib/theme'
import { useSheetHistory } from '../lib/useSheetHistory'
import { APP_VERSION } from '../lib/version'

interface SettingsDialogProps {
  onClose: () => void
  onNotify: (message: string) => void
  theme: Theme
  themePreference: ThemePreference
  onTheme: (theme: ThemePreference) => void
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function SettingsDialog({
  onClose,
  onNotify,
  theme,
  themePreference,
  onTheme,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const closeSheet = useSheetHistory('settings', onClose, () => Boolean(busy))
  const [pending, setPending] = useState<{ rows: TransactionInput[]; fileName: string } | null>(
    null,
  )
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const usage = await storageEstimate()
      let granted: boolean | null = null
      try {
        granted = navigator.storage?.persisted ? await navigator.storage.persisted() : null
      } catch {
        granted = null
      }
      if (!alive) return
      setEstimate(usage)
      setPersisted(granted)
    })()
    return () => {
      alive = false
    }
  }, [])

  const requestClose = () => {
    if (busy) return
    closeSheet()
  }

  const handleExport = async () => {
    setBusy('export')
    setMessage('')
    try {
      const items = await getSortedTransactions()
      downloadCsv(items)
      onNotify(`CSV diunduh: ${items.length} transaksi.`)
    } catch {
      setMessage('Export gagal. Coba lagi.')
    } finally {
      setBusy(null)
    }
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPending(null)
    setImportErrors([])
    setMessage('')
    try {
      const result = parseCsv(await file.text())
      if (result.errors.length > 0) {
        setImportErrors(result.errors)
        return
      }
      setPending({ rows: result.rows, fileName: file.name })
    } catch {
      setMessage('File tidak bisa dibaca.')
    }
  }

  const confirmImport = async () => {
    if (!pending) return
    setBusy('import')
    setMessage('')
    try {
      const existing = await getSortedTransactions()
      downloadCsv(existing, `expend-sebelum-import-${todayWIB()}.csv`)
      await replaceAllTransactions(pending.rows)
      onNotify(`${pending.rows.length} transaksi diimport. Data lama sudah diunduh sebagai CSV.`)
      setPending(null)
      closeSheet()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import gagal.')
      setBusy(null)
    }
  }

  const handlePersist = async () => {
    const granted = await requestPersistence()
    setPersisted(granted)
    onNotify(
      granted
        ? 'Penyimpanan permanen aktif.'
        : 'Browser belum memberikan izin penyimpanan permanen.',
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose()
      }}
    >
      <div className="sheet-form">
        <header className="sheet-head">
          <div>
            <h2 id="settings-title">Pengaturan</h2>
            <p className="sheet-sub">Expend versi {APP_VERSION}</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={requestClose}
            aria-label="Tutup pengaturan"
            disabled={Boolean(busy)}
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="sheet-body">
          <section className="settings-card">
            <div className="settings-card-head">
              <span className="setting-icon">
                {theme === 'dark' ? (
                  <Moon size={17} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Sun size={17} strokeWidth={1.75} aria-hidden="true" />
                )}
              </span>
              <div className="setting-text">
                <h3>Tema</h3>
                <p>Ikuti tema perangkat, atau pilih terang atau gelap secara permanen.</p>
              </div>
            </div>
            <div className="segmented segmented-compact" role="group" aria-label="Tema">
              <button
                type="button"
                aria-pressed={themePreference === 'system'}
                onClick={() => onTheme('system')}
              >
                Sistem
              </button>
              <button
                type="button"
                aria-pressed={themePreference === 'light'}
                onClick={() => onTheme('light')}
              >
                Terang
              </button>
              <button
                type="button"
                aria-pressed={themePreference === 'dark'}
                onClick={() => onTheme('dark')}
              >
                Gelap
              </button>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-head">
              <span className="setting-icon">
                <Database size={17} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="setting-text">
                <h3>Data di perangkat ini</h3>
                <p>
                  Transaksi disimpan di browser ini saja. Membersihkan data situs, memakai
                  mode privat, atau berganti browser akan menghilangkan semuanya.
                </p>
              </div>
            </div>
            {estimate ? (
              <p className="settings-meta mono">
                {formatBytes(estimate.usage)} dari {formatBytes(estimate.quota)}
              </p>
            ) : null}
            <p className="settings-meta">
              Penyimpanan permanen:{' '}
              {persisted === null ? 'tidak didukung' : persisted ? 'aktif' : 'belum aktif'}
            </p>
            {persisted !== true ? (
              <button type="button" className="btn btn-block" onClick={handlePersist}>
                Minta penyimpanan permanen
              </button>
            ) : null}
          </section>

          <section className="settings-card">
            <div className="settings-card-head">
              <span className="setting-icon">
                <Download size={17} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="setting-text">
                <h3>Export CSV</h3>
                <p>
                  Seluruh transaksi, urut tanggal. Enam kolom: nomor, tanggal, penerima,
                  nominal, sumber dana, keterangan.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-block"
              onClick={handleExport}
              disabled={busy === 'export'}
            >
              {busy === 'export' ? 'Menyiapkan...' : 'Unduh CSV'}
            </button>
          </section>

          <section className="settings-card">
            <div className="settings-card-head">
              <span className="setting-icon">
                <Upload size={17} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="setting-text">
                <h3>Import CSV</h3>
                <p>
                  Hanya menerima file hasil export Expend. Data sekarang diganti seluruhnya,
                  dan CSV lama diunduh otomatis sebelum penggantian.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-block"
              onClick={() => fileRef.current?.click()}
              disabled={Boolean(busy)}
            >
              Pilih file CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={handleFile}
            />

            {importErrors.length > 0 ? (
              <div className="error-box" role="alert">
                <p className="error-title">
                  <AlertCircle size={15} strokeWidth={1.75} aria-hidden="true" />
                  File belum bisa diimport
                </p>
                <ul className="error-list">
                  {importErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {pending ? (
              <div className="import-preview" role="status">
                <p>
                  {pending.rows.length} transaksi siap diimport dari{' '}
                  <span className="mono">{pending.fileName}</span>.
                </p>
                <p className="hint">Data saat ini akan diganti seluruhnya.</p>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    onClick={confirmImport}
                    disabled={busy === 'import'}
                  >
                    {busy === 'import' ? 'Mengimport...' : 'Ganti semua data'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => setPending(null)}
                    disabled={busy === 'import'}
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {message ? (
            <p className="error" role="alert">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </dialog>
  )
}
