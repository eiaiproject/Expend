import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useDialogDismiss } from '../lib/useDialogDismiss'
import { useSheetHistory } from '../lib/useSheetHistory'

export type Sort = 'newest' | 'oldest' | 'highest' | 'lowest'

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: 'newest', label: 'Terbaru' },
  { id: 'oldest', label: 'Terlama' },
  { id: 'highest', label: 'Nominal terbesar' },
  { id: 'lowest', label: 'Nominal terkecil' },
]

interface FilterSheetProps {
  readonly source: string
  readonly sort: Sort
  readonly sources: string[]
  readonly onSource: (source: string) => void
  readonly onSort: (sort: Sort) => void
  readonly onReset: () => void
  readonly onClose: () => void
}

export function FilterSheet({
  source,
  sort,
  sources,
  onSource,
  onSort,
  onReset,
  onClose,
}: FilterSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const close = useSheetHistory('filter', onClose)
  useDialogDismiss(dialogRef, close)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="filter-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="sheet-form">
        <header className="sheet-head">
          <div>
            <h2 id="filter-title">Filter</h2>
            <p className="sheet-sub">Sumber dana dan urutan daftar</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={close}
            aria-label="Tutup filter"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="sheet-body">
          <section className="filter-section">
            <h3>Sumber dana</h3>
            <div className="chip-grid">
              <button
                type="button"
                className="chip"
                aria-pressed={source === 'all'}
                onClick={() => onSource('all')}
              >
                Semua
              </button>
              {sources.map((item) => (
                <button
                  type="button"
                  className="chip"
                  key={item}
                  aria-pressed={source === item}
                  onClick={() => onSource(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className="filter-section">
            <h3>Urutan</h3>
            <div className="chip-grid">
              {SORTS.map((item) => (
                <button
                  type="button"
                  className="chip"
                  key={item.id}
                  aria-pressed={sort === item.id}
                  onClick={() => onSort(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="sheet-foot">
          <button type="button" className="btn" onClick={onReset}>
            Atur ulang
          </button>
          <button type="button" className="btn btn-primary" onClick={close}>
            Selesai
          </button>
        </footer>
      </div>
    </dialog>
  )
}
