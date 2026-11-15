import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUp, ImagePlus, ScanText, X } from 'lucide-react'
import { parseChat, type Draft } from '../lib/chatParser'
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

function previewParts(parsed: Draft | null, hideAmounts: boolean): string[] {
  if (!parsed) return []
  const parts: string[] = []
  if (parsed.payee) parts.push(parsed.payee)
  if (parsed.amount) parts.push(formatIDR(parsed.amount, hideAmounts))
  if (parsed.source) parts.push(parsed.source)
  return parts
}

interface ComposerProps {
  readonly onSubmit: (text: string) => void
  readonly onUpload: (file: File) => void
  readonly ocr: OcrState | null
  readonly onCancelOcr: () => void
  readonly ocrError: OcrErrorState | null
  readonly onRetryOcr: () => void
  readonly onDismissOcrError: () => void
  readonly resetToken: number
  readonly focusRequest: boolean
  readonly onFocusHandled: () => void
  readonly hideAmounts: boolean
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
  const preview = previewParts(parsed, hideAmounts)

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
          <output className="ocr-card" aria-live="polite">
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
            <progress
              className="meter"
              max={100}
              value={Math.max(2, Math.round(ocr.progress * 100))}
              aria-label="Progres membaca bukti transfer"
            />
          </output>
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
            {preview.length > 0 ? (
              <p className="dock-preview">{preview.join(' · ')}</p>
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
