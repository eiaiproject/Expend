import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Trash2, X } from 'lucide-react'
import { validateDraft, type Draft, type DraftErrors } from '../lib/chatParser'
import { visibleWarnings } from '../lib/draftWarnings'
import type { Transaction } from '../lib/db'
import { shortDate, todayWIB } from '../lib/date'
import { formatIDR, parseAmount } from '../lib/money'
import { SOURCES, canonicalSource, isKnownSource } from '../lib/sources'
import { useDialogDismiss } from '../lib/useDialogDismiss'
import { useSheetHistory } from '../lib/useSheetHistory'

interface DraftDialogProps {
  readonly mode: 'new' | 'edit'
  readonly initial: Draft
  readonly transaction?: Transaction
  readonly imageUrl?: string | null
  readonly hideAmounts: boolean
  readonly onClose: () => void
  readonly onSave: (draft: Draft) => Promise<void>
  readonly onDelete?: () => Promise<void>
}

interface DraftHeaderProps {
  readonly mode: 'new' | 'edit'
  readonly transaction?: Transaction
  readonly disabled: boolean
  readonly onClose: () => void
}

interface DraftPreviewProps {
  readonly payee: string
  readonly amount: number
  readonly source: string
  readonly date: string
  readonly hideAmounts: boolean
}

interface DraftWarningsProps {
  readonly warnings: string[]
}

interface DraftFieldsProps {
  readonly today: string
  readonly date: string
  readonly payee: string
  readonly amountText: string
  readonly source: string
  readonly customSource: boolean
  readonly note: string
  readonly errors: DraftErrors
  readonly parsedAmount: number | null
  readonly sourceUnknown: boolean
  readonly hideAmounts: boolean
  readonly onDate: (value: string) => void
  readonly onPayee: (value: string) => void
  readonly onAmount: (value: string) => void
  readonly onSource: (value: string) => void
  readonly onCustomSource: (value: boolean) => void
  readonly onNote: (value: string) => void
}

interface DraftDangerZoneProps {
  readonly number?: string
  readonly confirmDelete: boolean
  readonly deleting: boolean
  readonly onAskDelete: () => void
  readonly onCancelDelete: () => void
  readonly onDelete: () => void
}

interface DraftFooterProps {
  readonly discardOpen: boolean
  readonly saving: boolean
  readonly mode: 'new' | 'edit'
  readonly onKeepEditing: () => void
  readonly onDiscard: () => void
  readonly onClose: () => void
}

function focusTargetFor(initial: Draft): string {
  if (!initial.payee) return 'draft-payee'
  if (initial.amount === null) return 'draft-amount'
  if (!initial.source) return 'draft-source'
  return 'draft-payee'
}

function amountHint(parsedAmount: number | null, hideAmounts: boolean): string {
  if (!parsedAmount) return 'Contoh: 100000, 50rb, 1,5jt'
  return formatIDR(parsedAmount, hideAmounts)
}

function submitLabel(saving: boolean, mode: 'new' | 'edit'): string {
  if (saving) return 'Menyimpan...'
  return mode === 'edit' ? 'Simpan perubahan' : 'Simpan transaksi'
}

function DraftHeader({ mode, transaction, disabled, onClose }: DraftHeaderProps) {
  return (
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
        onClick={onClose}
        aria-label="Tutup pratinjau"
        disabled={disabled}
      >
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </header>
  )
}

function DraftPreview({ payee, amount, source, date, hideAmounts }: DraftPreviewProps) {
  return (
    <div className="preview-card" aria-live="polite">
      <span className="preview-payee">{payee.trim() || 'Penerima belum diisi'}</span>
      <span className="preview-amount mono">{formatIDR(amount, hideAmounts)}</span>
      <span className="preview-meta">
        {source || 'Sumber dana belum diisi'}
        <span aria-hidden="true"> · </span>
        {date}
      </span>
    </div>
  )
}

function DraftWarnings({ warnings }: DraftWarningsProps) {
  if (warnings.length === 0) return null
  return (
    <div className="alert-lines" aria-live="polite">
      {warnings.map((warning, index) => (
        <p className="alert-line" key={`${warning}-${index}`}>
          <AlertCircle size={15} strokeWidth={1.75} aria-hidden="true" />
          {warning}
        </p>
      ))}
    </div>
  )
}

function DraftFields({
  today,
  date,
  payee,
  amountText,
  source,
  customSource,
  note,
  errors,
  parsedAmount,
  sourceUnknown,
  hideAmounts,
  onDate,
  onPayee,
  onAmount,
  onSource,
  onCustomSource,
  onNote,
}: DraftFieldsProps) {
  const sourceDescribedBy = errors.source ?? (sourceUnknown ? 'draft-source-hint' : undefined)
  const sourceValue =
    customSource || (source.trim() && !isKnownSource(source))
      ? '__other'
      : canonicalSource(source)

  return (
    <>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="draft-date">Tanggal</label>
          <input
            id="draft-date"
            type="date"
            value={date}
            max={today}
            onChange={(event) => onDate(event.target.value)}
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
            onChange={(event) => onAmount(event.target.value)}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errors.amount ? 'draft-amount-error' : 'draft-amount-hint'}
          />
          {errors.amount ? (
            <p className="error" id="draft-amount-error">
              {errors.amount}
            </p>
          ) : (
            <p className="hint" id="draft-amount-hint">
              {amountHint(parsedAmount, hideAmounts)}
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
          onChange={(event) => onPayee(event.target.value)}
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
          value={sourceValue}
          onChange={(event) => {
            const value = event.target.value
            if (value === '__other') {
              onCustomSource(true)
              onSource('')
              return
            }
            onCustomSource(false)
            onSource(value)
          }}
          aria-invalid={Boolean(errors.source)}
          aria-describedby={sourceDescribedBy}
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
              onChange={(event) => onSource(event.target.value)}
              aria-invalid={Boolean(errors.source)}
              aria-describedby={sourceDescribedBy}
            />
          </>
        ) : null}
        {errors.source ? (
          <p className="error" id="draft-source-error">
            {errors.source}
          </p>
        ) : null}
        {!errors.source && sourceUnknown ? (
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
          onChange={(event) => onNote(event.target.value)}
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
    </>
  )
}

function DraftDangerZone({
  number,
  confirmDelete,
  deleting,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: DraftDangerZoneProps) {
  return (
    <div className="danger-zone">
      {confirmDelete ? (
        <div className="confirm-delete" role="alert">
          <p>
            Hapus transaksi ini? Nomor {number} bisa dipakai transaksi lain.
          </p>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn btn-small btn-primary"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? 'Menghapus...' : 'Ya, hapus'}
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={onCancelDelete}
              disabled={deleting}
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-danger-quiet" onClick={onAskDelete}>
          <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
          Hapus transaksi
        </button>
      )}
    </div>
  )
}

function DraftFooter({
  discardOpen,
  saving,
  mode,
  onKeepEditing,
  onDiscard,
  onClose,
}: DraftFooterProps) {
  return (
    <footer className="sheet-foot">
      {discardOpen ? (
        <div className="discard-confirm" role="alert">
          <p>Buang perubahan yang belum disimpan?</p>
          <div className="discard-actions">
            <button
              type="button"
              className="btn btn-small btn-primary"
              onClick={onKeepEditing}
              autoFocus
            >
              Lanjut edit
            </button>
            <button type="button" className="btn btn-small" onClick={onDiscard}>
              Buang
            </button>
          </div>
        </div>
      ) : (
        <div className="sheet-foot-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {submitLabel(saving, mode)}
          </button>
        </div>
      )}
    </footer>
  )
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
    document.getElementById(focusTargetFor(initial))?.focus()
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
  useDialogDismiss(dialogRef, requestClose)

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
    >
      <form className="sheet-form" onSubmit={submit} noValidate>
        <DraftHeader
          mode={mode}
          transaction={transaction}
          disabled={saving || deleting}
          onClose={requestClose}
        />

        <div className="sheet-body">
          <DraftPreview
            payee={payee}
            amount={parsedAmount ?? 0}
            source={canonicalSource(source)}
            date={previewDate}
            hideAmounts={hideAmounts}
          />
          <DraftWarnings warnings={warnings} />

          {imageUrl ? (
            <figure className="receipt">
              <img src={imageUrl} alt="Bukti transfer yang diunggah" />
              <figcaption className="hint">
                Gambar dibuang setelah pratinjau ditutup atau transaksi disimpan.
              </figcaption>
            </figure>
          ) : null}

          <DraftFields
            today={today}
            date={date}
            payee={payee}
            amountText={amountText}
            source={source}
            customSource={customSource}
            note={note}
            errors={errors}
            parsedAmount={parsedAmount}
            sourceUnknown={sourceUnknown}
            hideAmounts={hideAmounts}
            onDate={setDate}
            onPayee={setPayee}
            onAmount={setAmountText}
            onSource={setSource}
            onCustomSource={setCustomSource}
            onNote={setNote}
          />

          {mode === 'edit' && onDelete ? (
            <DraftDangerZone
              number={transaction?.number}
              confirmDelete={confirmDelete}
              deleting={deleting}
              onAskDelete={() => setConfirmDelete(true)}
              onCancelDelete={() => setConfirmDelete(false)}
              onDelete={remove}
            />
          ) : null}

          {formError ? (
            <p className="error" role="alert">
              {formError}
            </p>
          ) : null}
        </div>

        <DraftFooter
          discardOpen={discardOpen}
          saving={saving}
          mode={mode}
          onKeepEditing={() => setDiscardOpen(false)}
          onDiscard={close}
          onClose={requestClose}
        />
      </form>
    </dialog>
  )
}
