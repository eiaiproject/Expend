import { isValidISODate, todayWIB } from './date'
import type { Transaction, TransactionInput } from './db'
import { MAX_AMOUNT } from './money'

export const CSV_HEADER = [
  'nomor transaksi unik',
  'tanggal',
  'penerima',
  'nominal',
  'sumber dana',
  'keterangan tambahan',
] as const

export interface CsvParseResult {
  rows: TransactionInput[]
  errors: string[]
}

const FORMULA_PREFIX = /^[=+@\t\r-]/

function guardFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

function unguardFormula(value: string): string {
  return value.startsWith("'") && FORMULA_PREFIX.test(value.slice(1)) ? value.slice(1) : value
}

function escapeCell(value: string): string {
  const safe = guardFormula(value)
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function toCsv(transactions: Transaction[]): string {
  const lines = [CSV_HEADER.join(',')]
  for (const item of transactions) {
    lines.push(
      [item.number, item.date, item.payee, String(item.amount), item.source, item.note]
        .map(escapeCell)
        .join(','),
    )
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

interface QuotedScan {
  cell: string
  skipNext: boolean
  quoted: boolean
}

function readQuotedCell(source: string, index: number, cell: string): QuotedScan {
  if (source[index] !== '"') {
    return { cell: cell + source[index], skipNext: false, quoted: true }
  }
  if (source[index + 1] === '"') {
    return { cell: `${cell}"`, skipNext: true, quoted: true }
  }
  return { cell, skipNext: false, quoted: false }
}

function splitRows(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  let index = 0
  while (index < source.length) {
    if (quoted) {
      const scanned = readQuotedCell(source, index, cell)
      cell = scanned.cell
      quoted = scanned.quoted
      index += scanned.skipNext ? 2 : 1
      continue
    }
    const char = source[index]
    index += 1
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (char === '\r') continue
    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

export function parseCsv(text: string): CsvParseResult {
  const rows = splitRows(text)
  if (rows.length === 0) return { rows: [], errors: ['File kosong.'] }

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  if (
    header.length !== CSV_HEADER.length ||
    header.some((cell, index) => cell !== CSV_HEADER[index])
  ) {
    return {
      rows: [],
      errors: ['Header CSV tidak cocok. Import hanya menerima file hasil export Expend.'],
    }
  }

  const today = todayWIB()
  const parsed: TransactionInput[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  rows.slice(1).forEach((cells, index) => {
    const line = index + 2
    if (cells.length !== CSV_HEADER.length) {
      errors.push(`Baris ${line}: ${cells.length} kolom, seharusnya ${CSV_HEADER.length}.`)
      return
    }
    const [number, date, payeeRaw, amountRaw, sourceRaw, noteRaw] = cells.map((cell) =>
      cell.trim(),
    )
    const payee = unguardFormula(payeeRaw)
    const source = unguardFormula(sourceRaw)
    const note = unguardFormula(noteRaw)

    if (!/^EXP-\d{6,}$/.test(number)) {
      errors.push(`Baris ${line}: nomor transaksi tidak valid.`)
    } else if (seen.has(number)) {
      errors.push(`Baris ${line}: nomor ${number} ganda.`)
    } else {
      seen.add(number)
    }
    if (!isValidISODate(date)) errors.push(`Baris ${line}: tanggal harus berbentuk YYYY-MM-DD.`)
    else if (date > today) errors.push(`Baris ${line}: tanggal tidak boleh di masa depan.`)
    if (!payee) errors.push(`Baris ${line}: penerima kosong.`)
    if (!/^\d+$/.test(amountRaw) || Number(amountRaw) <= 0) {
      errors.push(`Baris ${line}: nominal harus angka bulat lebih dari 0.`)
    } else if (Number(amountRaw) > MAX_AMOUNT) {
      errors.push(`Baris ${line}: nominal terlalu besar.`)
    }
    if (!source) errors.push(`Baris ${line}: sumber dana kosong.`)
    if (note.length > 200) errors.push(`Baris ${line}: keterangan lebih dari 200 karakter.`)
    if (payee.length > 80) errors.push(`Baris ${line}: penerima lebih dari 80 karakter.`)

    parsed.push({
      number,
      date,
      payee,
      amount: Number(amountRaw),
      source,
      note,
    })
  })

  if (errors.length > 0) {
    const shown = errors.slice(0, 8)
    if (errors.length > shown.length) {
      shown.push(`Masih ada ${errors.length - shown.length} masalah lain.`)
    }
    return { rows: [], errors: shown }
  }

  return { rows: parsed, errors: [] }
}

export function downloadCsv(transactions: Transaction[], filename?: string): void {
  const blob = new Blob([toCsv(transactions)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename ?? `expend-${todayWIB()}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
