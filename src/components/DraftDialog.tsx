import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Trash2, X } from 'lucide-react'
import { validateDraft, type Draft, type DraftErrors } from '../lib/chatParser'
import { visibleWarnings } from '../lib/draftWarnings'
import type { Transaction } from '../lib/db'
import { shortDate, todayWIB } from '../lib/date'
import { formatIDR, parseAmount } from '../lib/money'
import { SOURCES, canonicalSource, isKnownSource } from '../lib/sources'
import { useSheetHistory } from '../lib/useSheetHistory'

interface DraftDialogProps {
  mode: 'new' | 'edit'
  initial: Draft
  transaction?: Transaction
  imageUrl?: string | null
  hideAmounts: boolean
  onClose: () => void
  onSave: (draft: Draft) => Promise<void>
  onDelete?: () => Promise<void>
}

export function DraftDialog({
  mode,
  initial,
  transaction,
  imageUrl,
  hideAmounts,
  onClose,
  onSave,
  onDelete,
}: DraftDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const initialValues = useRef({
    date: initial.date,
    payee: initial.payee,
    amountText: initial.amount === null ? '' : String(initial.amount),
    source: initial.source,
    note: initial.note,
  })
  const today = todayWIB()
  const [discardOpen, setDiscardOpen] = useState(false)
  const [date, setDate] = useState(initial.date)
  const [payee, setPayee] = useState(initial.payee)
  const [amountText, setAmountText] = useState(
    initial.amount === null ? '' : String(initial.amount),
  )
  const [source, setSource] = useState(initial.source)
  const [customSource, setCustomSource] = useState(
    Boolean(initial.source.trim()) && !isKnownSource(initial.source),
  )
  const [note, setNote] = useState(initial.note)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    const focusTarget = !initial.payee
      ? 'draft-payee'
      : initial.amount === null
        ? 'draft-amount'
        : !initial.source
          ? 'draft-source'
          : 'draft-payee'
    document.getElementById(focusTarget)?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [initial])

  const dirty =
    date !== initialValues.current.date ||
    payee !== initialValues.current.payee ||
    amountText !== initialValues.current.amountText ||
    source !== initialValues.current.source ||
    note !== initialValues.current.note

  const handleBack = () => {
    if (saving || deleting) return true
    if (dirty || (mode === 'new' && imageUrl)) {
      setDiscardOpen(true)
      return true
    }
    return false
  }

  const close = useSheetHistory('draft', onClose, handleBack)

  const requestClose = () => {
    if (handleBack()) return
    close()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const draft: Draft = {
      date,
      payee: payee.trim(),
      amount: parseAmount(amountText),
      source: canonicalSource(source),
      note: note.trim(),
      raw: initial.raw,
      warnings: initial.warnings,
    }
    const nextErrors = validateDraft(draft, today)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Lengkapi field yang ditandai.')
      const first = Object.keys(nextErrors)[0]
      document.getElementById(`draft-${first}`)?.focus()
      return
    }
    setFormError('')
    setSaving(true)
    try {
      await onSave(draft)
      close()
    } catch {
      setFormError('Gagal menyimpan. Coba lagi.')
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!onDelete) return
    setDeleting(true)
    setFormError('')
    try {
      await onDelete()
      close()
    } catch {
      setFormError('Gagal menghapus. Coba lagi.')
      setDeleting(false)
    }
  }

  const parsedAmount = parseAmount(amountText)
  const warnings = visibleWarnings(initial.warnings, {
    date,
    initialDate: initialValues.current.date,
    payee,
    amount: parsedAmount,
    source,
  })
  const sourceUnknown = source.trim().length > 0 && !isKnownSource(source)
  const previewDate = date ? shortDate(date) : 'Tanggal belum diisi'

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="draft-title"
      onCancel={(event) => {
        event.preventDefault()
        if (discardOpen) {
          setDiscardOpen(false)
          return
        }
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose()
      }}
    >
      <form className="sheet-form" onSubmit={submit} noValidate>
        <header className="sheet-head">
          <div>
            <h2 id="draft-title">{mode === 'new' ? 'Pratinjau' : 'Ubah transaksi'}</h2>
            <p className="sheet-sub">
              {transaction ? (
                <span className="mono">{transaction.number}</span>
              ) : (
                'Periksa sebelum disimpan'
              )}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={requestClose}
            aria-label="Tutup pratinjau"
            disabled={saving || deleting}
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="sheet-body">
          <div className="preview-card" aria-live="polite">
            <span className="preview-payee">{payee.trim() || 'Penerima belum diisi'}</span>
            <span className="preview-amount mono">
              {formatIDR(parsedAmount ?? 0, hideAmounts)}
            </span>
            <span className="preview-meta">
              {canonicalSource(source) || 'Sumber dana belum diisi'}
              <span aria-hidden="true"> · </span>
              {previewDate}
            </span>
          </div>

          {warnings.length > 0 ? (
            <div className="alert-lines" role="status">
              {warnings.map((warning, index) => (
                <p className="alert-line" key={`${warning}-${index}`}>
                  <AlertCircle size={15} strokeWidth={1.75} aria-hidden="true" />
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          {imageUrl ? (
            <figure className="receipt">
              <img src={imageUrl} alt="Bukti transfer yang diunggah" />
              <figcaption className="hint">
                Gambar dibuang setelah pratinjau ditutup atau transaksi disimpan.
              </figcaption>
            </figure>
          ) : null}

          <div className="field-grid">
            <div className="field">
              <label htmlFor="draft-date">Tanggal</label>
              <input
                id="draft-date"
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? 'draft-date-error' : undefined}
              />
              {errors.date ? (
                <p className="error" id="draft-date-error">
                  {errors.date}
                </p>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="draft-amount">Nominal</label>
              <input
                id="draft-amount"
                inputMode="text"
                autoComplete="off"
                value={amountText}
                placeholder="100000"
                onChange={(event) => setAmountText(event.target.value)}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? 'draft-amount-error' : 'draft-amount-hint'}
              />
              {errors.amount ? (
                <p className="error" id="draft-amount-error">
                  {errors.amount}
                </p>
              ) : (
                <p className="hint" id="draft-amount-hint">
                  {parsedAmount
                    ? formatIDR(parsedAmount, hideAmounts)
                    : 'Contoh: 100000, 50rb, 1,5jt'}
                </p>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="draft-payee">Penerima</label>
            <input
              id="draft-payee"
              value={payee}
              maxLength={80}
              autoComplete="off"
              placeholder="Indomaret"
              onChange={(event) => setPayee(event.target.value)}
              aria-invalid={Boolean(errors.payee)}
              aria-describedby={errors.payee ? 'draft-payee-error' : undefined}
            />
            {errors.payee ? (
              <p className="error" id="draft-payee-error">
                {errors.payee}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="draft-source">Sumber dana</label>
            <select
              id="draft-source"
              value={
                customSource || (source.trim() && !isKnownSource(source))
                  ? '__other'
                  : canonicalSource(source)
              }
              onChange={(event) => {
                const value = event.target.value
                if (value === '__other') {
                  setCustomSource(true)
                  setSource('')
                  return
                }
                setCustomSource(false)
                setSource(value)
              }}
              aria-invalid={Boolean(errors.source)}
              aria-describedby={
                errors.source ? 'draft-source-error' : sourceUnknown ? 'draft-source-hint' : undefined
              }
            >
              <option value="">Pilih sumber dana</option>
              {SOURCES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value="__other">Lainnya</option>
            </select>
            {customSource ? (
              <>
                <label className="sr-only" htmlFor="draft-source-custom">
                  Sumber dana lainnya
                </label>
                <input
                  id="draft-source-custom"
                  value={source}
                  autoComplete="off"
                  placeholder="Tulis sumber dana"
                  onChange={(event) => setSource(event.target.value)}
                  aria-invalid={Boolean(errors.source)}
                  aria-describedby={
                    errors.source
                      ? 'draft-source-error'
                      : sourceUnknown
                        ? 'draft-source-hint'
                        : undefined
                  }
                />
              </>
            ) : null}
            {errors.source ? (
              <p className="error" id="draft-source-error">
                {errors.source}
              </p>
            ) : sourceUnknown ? (
              <p className="hint" id="draft-source-hint">
                Di luar daftar sumber dana. Tetap bisa disimpan.
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="draft-note">Keterangan tambahan</label>
            <textarea
              id="draft-note"
              rows={2}
              value={note}
              maxLength={200}
              placeholder="belanja bulanan"
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={errors.note ? 'draft-note-error' : undefined}
            />
            <p className="hint">{note.length}/200</p>
            {errors.note ? (
              <p className="error" id="draft-note-error">
                {errors.note}
              </p>
            ) : null}
          </div>

          {mode === 'edit' && onDelete ? (
            <div className="danger-zone">
              {confirmDelete ? (
                <div className="confirm-delete" role="alert">
                  <p>
                    Hapus transaksi ini? Nomor {transaction?.number} bisa dipakai transaksi
                    lain.
                  </p>
                  <div className="confirm-actions">
                    <button
                      type="button"
                      className="btn btn-small btn-primary"
                      onClick={remove}
                      disabled={deleting}
                    >
                      {deleting ? 'Menghapus...' : 'Ya, hapus'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger-quiet"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                  Hapus transaksi
                </button>
              )}
            </div>
          ) : null}

          {formError ? (
            <p className="error" role="alert">
              {formError}
            </p>
          ) : null}
        </div>

        <footer className="sheet-foot">
          {discardOpen ? (
            <div className="discard-confirm" role="alert">
              <p>Buang perubahan yang belum disimpan?</p>
              <div className="discard-actions">
                <button
                  type="button"
                  className="btn btn-small btn-primary"
                  onClick={() => setDiscardOpen(false)}
                  autoFocus
                >
                  Lanjut edit
                </button>
                <button type="button" className="btn btn-small" onClick={close}>
                  Buang
                </button>
              </div>
            </div>
          ) : (
            <div className="sheet-foot-actions">
              <button type="button" className="btn" onClick={requestClose} disabled={saving}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Menyimpan...' : mode === 'new' ? 'Simpan transaksi' : 'Simpan perubahan'}
              </button>
            </div>
          )}
        </footer>
      </form>
    </dialog>
  )
}
