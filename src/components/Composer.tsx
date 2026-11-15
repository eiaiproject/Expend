import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUp, ImagePlus, ScanText, X } from 'lucide-react'
import { parseChat } from '../lib/chatParser'
import { formatIDR } from '../lib/money'
import type { OcrPhase } from '../lib/ocr'

interface OcrState {
  progress: number
  fileName: string
  phase: OcrPhase
}

interface OcrErrorState {
  fileName: string
  message: string
}

interface ComposerProps {
  onSubmit: (text: string) => void
  onUpload: (file: File) => void
  ocr: OcrState | null
  onCancelOcr: () => void
  ocrError: OcrErrorState | null
  onRetryOcr: () => void
  onDismissOcrError: () => void
  resetToken: number
  focusRequest: boolean
  onFocusHandled: () => void
  hideAmounts: boolean
}

export function Composer({
  onSubmit,
  onUpload,
  ocr,
  onCancelOcr,
  ocrError,
  onRetryOcr,
  onDismissOcrError,
  resetToken,
  focusRequest,
  onFocusHandled,
  hideAmounts,
}: ComposerProps) {
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 96)}px`
  }, [text])

  useEffect(() => {
    if (resetToken > 0) setText('')
  }, [resetToken])

  useEffect(() => {
    if (!focusRequest) return
    textareaRef.current?.focus()
    onFocusHandled()
  }, [focusRequest, onFocusHandled])

  const submit = () => {
    const value = text.trim()
    if (!value) return
    onSubmit(value)
  }

  const parsed = text.trim() ? parseChat(text) : null
  const previewParts = parsed
    ? [parsed.payee, parsed.amount ? formatIDR(parsed.amount, hideAmounts) : null, parsed.source].filter(
        Boolean,
      )
    : []

  return (
    <div className="composer-dock">
      <div className="dock-stack">
        {ocrError ? (
          <div className="ocr-card ocr-card-error" role="alert">
            <div className="ocr-head">
              <span className="ocr-title">
                <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
                Bukti belum terbaca
              </span>
              <button
                type="button"
                className="ocr-cancel"
                onClick={onDismissOcrError}
                aria-label="Tutup pesan OCR"
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <p className="ocr-file mono">{ocrError.fileName}</p>
            <p className="ocr-error-text">{ocrError.message}</p>
            <div className="ocr-actions">
              <button type="button" className="btn btn-small" onClick={onRetryOcr}>
                Coba lagi
              </button>
            </div>
          </div>
        ) : null}

        {ocr ? (
          <div className="ocr-card" role="status" aria-live="polite">
            <div className="ocr-head">
              <span className="ocr-title">
                <ScanText size={16} strokeWidth={1.75} aria-hidden="true" />
                {ocr.phase}
              </span>
              <button
                type="button"
                className="ocr-cancel"
                onClick={onCancelOcr}
                aria-label="Batalkan pembacaan bukti"
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <p className="ocr-file mono">
              {ocr.fileName}
              {ocr.phase === 'Membaca teks'
                ? ` · ${Math.round(ocr.progress * 100)}%`
                : ' · menyiapkan'}
            </p>
            <div
              className="meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ocr.progress * 100)}
              aria-label="Progres membaca bukti transfer"
            >
              <span style={{ transform: `scaleX(${Math.max(ocr.progress, 0.02)})` }} />
            </div>
          </div>
        ) : null}

        <form
          className="dock"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <button
            type="button"
            className="dock-attach"
            onClick={() => fileRef.current?.click()}
            aria-label="Unggah bukti transfer"
            title="Unggah bukti transfer"
            disabled={Boolean(ocr)}
          >
            <ImagePlus size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onUpload(file)
              event.target.value = ''
            }}
          />

          <div className="dock-field">
            <label className="sr-only" htmlFor="chat-input">
              Baris pengeluaran
            </label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              rows={1}
              value={text}
              placeholder="[penerima] [nominal] [sumber dana] [keterangan?]"
              autoComplete="off"
              enterKeyHint="send"
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            {previewParts.length > 0 ? (
              <p className="dock-preview">{previewParts.join(' · ')}</p>
            ) : null}
          </div>

          <button
            type="submit"
            className="dock-send"
            disabled={!text.trim()}
            aria-label="Buat pratinjau transaksi"
          >
            <ArrowUp size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  )
}
