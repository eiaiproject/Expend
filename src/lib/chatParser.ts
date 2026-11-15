import { isValidISODate, todayWIB } from './date'
import { MAX_AMOUNT, parseAmount } from './money'
import { matchSourceAt } from './sources'

export interface Draft {
  date: string
  payee: string
  amount: number | null
  source: string
  note: string
  raw: string
  warnings: string[]
}

export interface DraftErrors {
  [field: string]: string
}

interface Candidate {
  index: number
  end: number
  value: number
  explicit: boolean
}

interface SourceMatch {
  name: string
  index: number
  length: 1 | 2 | 3
}

interface DateInfo {
  date: string
  consumed: number
  warning?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SHORT_DATE = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/
const CURRENCY_ONLY = /^(rp|idr)\.?$/i
const CURRENCY_PREFIX = /^(rp|idr)\.?(.+)$/i
const AMOUNT_SUFFIX = /^(rb|ribu|k|jt|juta)$/

export function emptyDraft(today = todayWIB()): Draft {
  return {
    date: today,
    payee: '',
    amount: null,
    source: '',
    note: '',
    raw: '',
    warnings: [],
  }
}

function invalidDate(today: string): DateInfo {
  return { date: today, consumed: 1, warning: 'Tanggal tidak dikenali, dipakai hari ini.' }
}

function parseYear(rawYear: string | undefined, today: string): number {
  if (!rawYear) return Number(today.slice(0, 4))
  return rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)
}

function takeIsoDate(first: string, today: string): DateInfo | null {
  if (!ISO_DATE.test(first)) return null
  return isValidISODate(first) ? { date: first, consumed: 1 } : invalidDate(today)
}

function takeShortDate(first: string, today: string): DateInfo | null {
  const parts = SHORT_DATE.exec(first)
  if (!parts) return null

  const year = parseYear(parts[3], today)
  const iso = `${String(year).padStart(4, '0')}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  return isValidISODate(iso) ? { date: iso, consumed: 1 } : invalidDate(today)
}

function takeDate(tokens: string[], today: string): DateInfo {
  const first = tokens[0]
  if (!first) return { date: today, consumed: 0 }
  return takeIsoDate(first, today) ?? takeShortDate(first, today) ?? { date: today, consumed: 0 }
}

function prefixedAmount(
  tokens: string[],
  index: number,
): { candidate: Candidate; advance: number } | null {
  if (!CURRENCY_ONLY.test(tokens[index])) return null
  const next = tokens[index + 1]
  if (!next) return null
  const value = parseAmount(next)
  if (value === null) return null
  return {
    candidate: { index, end: index + 1, value, explicit: true },
    advance: 1,
  }
}

function attachedOrPlainAmount(
  tokens: string[],
  index: number,
): { candidate: Candidate; advance: number } | null {
  const token = tokens[index]
  const attached = CURRENCY_PREFIX.exec(token)
  const numeric = attached?.[2] ?? token
  const value = parseAmount(numeric)
  if (value === null) return null

  const suffix = tokens[index + 1]?.toLowerCase()
  if (suffix && AMOUNT_SUFFIX.test(suffix)) {
    return {
      candidate: {
        index,
        end: index + 1,
        value: parseAmount(`${numeric}${suffix}`) ?? value,
        explicit: Boolean(attached),
      },
      advance: 1,
    }
  }

  return {
    candidate: { index, end: index, value, explicit: Boolean(attached) },
    advance: 0,
  }
}

function amountCandidates(tokens: string[], start: number): Candidate[] {
  const candidates: Candidate[] = []

  for (let i = start; i < tokens.length; i += 1) {
    const amount = prefixedAmount(tokens, i) ?? attachedOrPlainAmount(tokens, i)
    if (!amount) continue
    candidates.push(amount.candidate)
    i += amount.advance
  }

  return candidates
}

function findCandidateWithSource(
  tokens: string[],
  candidates: Candidate[],
): { chosen: Candidate; source: SourceMatch } | null {
  for (const candidate of candidates) {
    const index = candidate.end + 1
    if (index >= tokens.length) continue
    const match = matchSourceAt(tokens, index)
    if (match) return { chosen: candidate, source: { ...match, index } }
  }
  return null
}

function findSource(tokens: string[], start: number, chosen: Candidate | null): SourceMatch | null {
  for (let i = start; i < tokens.length; i += 1) {
    if (chosen && i >= chosen.index && i <= chosen.end) continue
    const match = matchSourceAt(tokens, i)
    if (match) return { ...match, index: i }
  }
  return null
}

function payeeEndFor(tokens: string[], chosen: Candidate | null, source: SourceMatch | null): number {
  if (chosen) return chosen.index
  if (source) return source.index
  return tokens.length
}

function trimWrapping(value: string): string {
  return value.replace(/^[\s,.;:]+/, '').replace(/[\s,.;:]+$/, '')
}

function buildPayee(
  tokens: string[],
  start: number,
  end: number,
  source: SourceMatch | null,
): string {
  const parts: string[] = []
  for (let i = start; i < end; i += 1) {
    if (source && i >= source.index && i < source.index + source.length) continue
    if (CURRENCY_ONLY.test(tokens[i])) continue
    parts.push(tokens[i])
  }
  return trimWrapping(parts.join(' '))
}

function buildNote(tokens: string[], chosen: Candidate, source: SourceMatch | null): string {
  const sourceAfterAmount = source !== null && source.index > chosen.end
  const noteStart = sourceAfterAmount ? source.index + source.length : chosen.end + 1
  return trimWrapping(tokens.slice(noteStart).join(' '))
}

export function parseChat(input: string, today = todayWIB()): Draft {
  const raw = input.trim().replace(/\s+/g, ' ')
  if (!raw) return emptyDraft(today)

  const tokens = raw.split(' ')
  const dateInfo = takeDate(tokens, today)
  const start = dateInfo.consumed
  const warnings: string[] = []
  if (dateInfo.warning) warnings.push(dateInfo.warning)

  const candidates = amountCandidates(tokens, start)
  const matched = findCandidateWithSource(tokens, candidates)
  const chosen =
    matched?.chosen ??
    candidates.find((candidate) => candidate.explicit || candidate.value >= 1000) ??
    null
  const source = matched?.source ?? findSource(tokens, start, chosen)
  const payeeEnd = payeeEndFor(tokens, chosen, source)
  const payee = buildPayee(tokens, start, payeeEnd, source)
  const note = chosen ? buildNote(tokens, chosen, source) : ''

  if (!payee) warnings.push('Penerima belum terdeteksi.')
  if (!chosen) warnings.push('Nominal belum terdeteksi.')
  if (!source) warnings.push('Sumber dana belum terdeteksi.')

  return {
    date: dateInfo.date,
    payee,
    amount: chosen?.value ?? null,
    source: source?.name ?? '',
    note,
    raw,
    warnings,
  }
}

export function validateDraft(draft: Draft, today = todayWIB()): DraftErrors {
  const errors: DraftErrors = {}

  if (!draft.payee.trim()) errors.payee = 'Isi nama penerima.'
  else if (draft.payee.trim().length > 80) errors.payee = 'Maksimal 80 karakter.'

  if (draft.amount === null || !Number.isFinite(draft.amount) || draft.amount <= 0) {
    errors.amount = 'Nominal harus lebih dari 0.'
  } else if (draft.amount > MAX_AMOUNT) {
    errors.amount = 'Nominal terlalu besar.'
  }

  if (!draft.date || !isValidISODate(draft.date)) errors.date = 'Tanggal tidak valid.'
  else if (draft.date > today) errors.date = 'Tanggal tidak boleh di masa depan.'

  if (!draft.source.trim()) errors.source = 'Isi sumber dana.'

  if (draft.note.length > 200) errors.note = 'Maksimal 200 karakter.'

  return errors
}
