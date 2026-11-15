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

function takeDate(
  tokens: string[],
  today: string,
): { date: string; consumed: number; warning?: string } {
  const first = tokens[0]
  if (!first) return { date: today, consumed: 0 }

  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    if (isValidISODate(first)) return { date: first, consumed: 1 }
    return { date: today, consumed: 1, warning: 'Tanggal tidak dikenali, dipakai hari ini.' }
  }

  const parts = first.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/)
  if (parts) {
    const year = parts[3]
      ? parts[3].length === 2
        ? 2000 + Number(parts[3])
        : Number(parts[3])
      : Number(today.slice(0, 4))
    const iso = `${String(year).padStart(4, '0')}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    if (isValidISODate(iso)) return { date: iso, consumed: 1 }
    return { date: today, consumed: 1, warning: 'Tanggal tidak dikenali, dipakai hari ini.' }
  }

  return { date: today, consumed: 0 }
}

function amountCandidates(tokens: string[], start: number): Candidate[] {
  const candidates: Candidate[] = []

  for (let i = start; i < tokens.length; i += 1) {
    const token = tokens[i]

    if (/^(rp|idr)\.?$/i.test(token)) {
      const next = tokens[i + 1]
      if (!next) continue
      const value = parseAmount(next)
      if (value !== null) {
        candidates.push({ index: i, end: i + 1, value, explicit: true })
        i += 1
      }
      continue
    }

    const attached = token.match(/^(rp|idr)\.?(.+)$/i)
    const numeric = attached ? attached[2] : token
    const value = parseAmount(numeric)
    if (value === null) continue

    const suffix = tokens[i + 1]?.toLowerCase()
    if (suffix && /^(rb|ribu|k|jt|juta)$/.test(suffix)) {
      candidates.push({
        index: i,
        end: i + 1,
        value: parseAmount(`${numeric}${suffix}`) ?? value,
        explicit: Boolean(attached),
      })
      i += 1
      continue
    }

    candidates.push({ index: i, end: i, value, explicit: Boolean(attached) })
  }

  return candidates
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
  let chosen: Candidate | null = null
  let source = ''
  let sourceIndex = -1
  let sourceLength = 0

  for (const candidate of candidates) {
    const nextIndex = candidate.end + 1
    if (nextIndex < tokens.length) {
      const match = matchSourceAt(tokens, nextIndex)
      if (match) {
        chosen = candidate
        source = match.name
        sourceIndex = nextIndex
        sourceLength = match.length
        break
      }
    }
  }

  if (!chosen) {
    chosen = candidates.find((candidate) => candidate.explicit || candidate.value >= 1000) ?? null
  }

  if (!source) {
    for (let i = start; i < tokens.length; i += 1) {
      if (chosen && i >= chosen.index && i <= chosen.end) continue
      const match = matchSourceAt(tokens, i)
      if (match) {
        source = match.name
        sourceIndex = i
        sourceLength = match.length
        break
      }
    }
  }

  const payeeEnd = chosen ? chosen.index : sourceIndex >= 0 ? sourceIndex : tokens.length
  const payeeParts: string[] = []
  for (let i = start; i < payeeEnd; i += 1) {
    if (sourceIndex >= 0 && i >= sourceIndex && i < sourceIndex + sourceLength) continue
    if (/^(rp|idr)\.?$/i.test(tokens[i])) continue
    payeeParts.push(tokens[i])
  }

  const payee = payeeParts.join(' ').replace(/^[\s,.;:]+|[\s,.;:]+$/g, '')

  let note = ''
  if (chosen) {
    const noteStart =
      sourceIndex > chosen.end ? sourceIndex + sourceLength : chosen.end + 1
    note = tokens.slice(noteStart).join(' ').replace(/^[\s,.;:]+|[\s,.;:]+$/g, '')
  }

  if (!payee) warnings.push('Penerima belum terdeteksi.')
  if (!chosen) warnings.push('Nominal belum terdeteksi.')
  if (!source) warnings.push('Sumber dana belum terdeteksi.')

  return {
    date: dateInfo.date,
    payee,
    amount: chosen?.value ?? null,
    source,
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
