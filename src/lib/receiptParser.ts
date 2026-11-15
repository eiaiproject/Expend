import type { Draft } from './chatParser'
import { isValidISODate, todayWIB } from './date'
import { parseAmount } from './money'
import { matchSourceAt } from './sources'

export interface ReceiptResult extends Draft {
  teksMentah: string
  bank: string | null
}

const BULAN: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  mei: '05',
  may: '05',
  jun: '06',
  jul: '07',
  agu: '08',
  aug: '08',
  sep: '09',
  okt: '10',
  oct: '10',
  nov: '11',
  des: '12',
  dec: '12',
}

const RE_TANGGAL = /([0-9Oo]{1,2})\s*([A-Za-z]{3,})\.?\s+(\d{4})/
const RE_TANGGAL_ANGKA = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/
const RE_NOMINAL = /(?:Rp|IDR)\.?\s?([\d.,]+)/i
const RE_NAMA = /^[A-Z][A-Z\s.'-]{2,}$/
const RE_NAMA_UMUM = /^[A-Za-z][A-Za-z0-9\s.'&/-]{1,60}$/
const RE_BUKAN_NAMA =
  /^(transfer|transaksi|berhasil|sukses|detail|tanggal|waktu|jumlah|nominal|total|biaya|admin|bank|bca|bri|bni|mandiri|jago|seabank|gopay|ovo|dana|shopeepay|tunai|reference|ref|no|id|status|metode|sumber|penerima|beneficiary|recipient|source|amount|memo|keterangan|catatan|berita|description|remarks)\b/i
const LABEL_KET = /(berita\s+transfer|berita|catatan|keterangan|memo|description|remarks)/i
const RE_KET_LABEL =
  /^(?:berita\s+transfer|berita|catatan|keterangan|memo|description|remarks)\s*[:\-]?\s*/i

const LABEL_PENERIMA = /^penerima\b/i
const LABEL_DETAIL = /^detail\s+transaksi\b/i
const LABEL_SUMBER = /^sumber\s+dana\b/i
const STOP_MANDIRI = (line: string) =>
  LABEL_PENERIMA.test(line) ||
  LABEL_DETAIL.test(line) ||
  LABEL_SUMBER.test(line) ||
  /^(beneficiary|sender)\b/i.test(line)

const LABEL_JAGO =
  /^(id\s+transaksi|sumber\s+(akun|dana)|tanggal\s*(&|dan)\s*waktu|nama\s+acquirer|biaya|pan\s+(merchant|pelanggan)|id\s+terminal|nomor\s+referensi|resi\b)/i
const isLogoJago = (line: string) => /^(?:bank\s+)?jago(?:\s+syariah)?$/i.test(line)

const LABEL_SEABANK =
  /^(dari|ke|jumlah\s+transfer|no\.?\s*(transaksi|referensi)|metode\s+transaksi|product|waktu\s+transaksi|username|butuh\s+bantuan|resi\b|bukti\s+transaksi)/i

const LABEL_BCA =
  /^(beneficiary\s+(name|account)|transaction\s+type|transfer\s+(currency|amount|successful)|source\s+(of\s+fund|currency)|reference\s+no\.?)/i
const isWatermarkBCA = (line: string) => /^(bca|grup\s+bca)$/i.test(line)

const LABEL_BRI =
  /^(sumber\s+dana|tujuan|jenis\s+transaksi|nominal|biaya\s+admin|no\.?\s*ref|informasi|npwp|total\s+transaksi)/i
const isWatermarkBRI = (line: string) => /^bri$/i.test(line)

const LABEL_GOPAY =
  /^(rincian\s+transaksi|status|metode\s+pembayaran|waktu|id\s+transaksi|jumlah|total|dikirim\s+dari|aplikasi\s+ringan|download|get\s+it)/i
const RE_PENERIMA_GOPAY = /^(?:ditransfer|dibayar|dikirim)\s+ke\s+(.+)$/i

const LABEL_PENERIMA_UMUM =
  /^(penerima|nama\s+penerima|beneficiary(?:\s+name)?|recipient|tujuan|ke|kepada|ditransfer\s+ke|dibayar\s+ke|dikirim\s+ke)\b/i
const LABEL_SUMBER_UMUM = /^(sumber\s+dana|source\s+of\s+fund|sumber)\b/i

const LABEL_JAGO_PAYEE = [
  /^(?:nama\s+)?penerima\b/i,
  /^(?:tujuan|recipient)\b/i,
  /^(?:transfer|ditransfer|dibayar|dikirim)\s+ke\b/i,
  /^(?:ke|kepada)\b/i,
  /^(?:nama\s+)?merchant(?:\s+name)?\b/i,
  /^(?:nama\s+)?toko\b/i,
]

const isBankName = (line: string) =>
  /^(?:bank\s+)?(?:bca|bri|bni|mandiri|jago|seabank|gopay|ovo|dana|shopeepay|tunai)\b/i.test(
    line,
  )

const isJagoAmount = (line: string) =>
  /^(?:rp|idr)\b/i.test(line) || /^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?$/.test(line)

const isJagoAccount = (line: string) =>
  /(?:^|\s)(?:\*{2,}|•{2,}|x{2,})\s*\d{2,}/i.test(line) ||
  /^\d[\d\s.-]{5,}$/.test(line) ||
  /\b(?:rekening|account|jago\s*id|no\.?\s*(?:rek|akun))\b/i.test(line)

const isJagoStatus = (line: string) =>
  /^(?:transfer|transaksi|pembayaran|pembelian|top\s*up|berhasil|sukses|selesai|pending|gagal|bukti\s+transaksi|detail\s+transaksi)\b/i.test(
    line,
  )

const isJagoName = (line: string) =>
  RE_NAMA_UMUM.test(line) &&
  !RE_BUKAN_NAMA.test(line) &&
  !LABEL_PENERIMA_UMUM.test(line) &&
  !LABEL_SUMBER_UMUM.test(line) &&
  !LABEL_JAGO.test(line) &&
  !LABEL_KET.test(line) &&
  !/^(?:dari|pengirim|sender)\b/i.test(line) &&
  !isBankName(line) &&
  !isJagoAccount(line) &&
  !isJagoAmount(line) &&
  !isJagoStatus(line) &&
  !/\d{4,}/.test(line) &&
  !/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line)

function namaJago(lines: string[], index: number, label: RegExp): string {
  const sameLine = lines[index].replace(label, '').replace(/^[:\s-]+/, '').trim()
  if (isJagoName(sameLine)) return sameLine

  for (let i = index + 1; i < Math.min(lines.length, index + 8); i += 1) {
    const line = lines[i]
    if (isJagoName(line)) return line
    if (
      LABEL_JAGO.test(line) ||
      LABEL_KET.test(line) ||
      LABEL_PENERIMA_UMUM.test(line) ||
      LABEL_SUMBER_UMUM.test(line) ||
      isJagoAmount(line) ||
      isJagoStatus(line) ||
      /^(?:tanggal|waktu|jam|nominal|jumlah|total|amount|status|metode|biaya|admin)\b/i.test(
        line,
      ) ||
      /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line)
    ) {
      break
    }
  }
  return ''
}

function namaCadanganJago(lines: string[]): string {
  const senderIndex = lines.findIndex((line) => /^(?:dari|pengirim|sender)\b/i.test(line))
  const senderValue = senderIndex > -1 ? lines[senderIndex + 1] : ''
  const candidates = lines
    .filter((line) => line !== senderValue && isJagoName(line))
    .map((line) => line.replace(/^QR\s+/i, '').trim())
    .filter(Boolean)
  return candidates[0] ?? ''
}

const isLabelUmum = (line: string) =>
  STOP_MANDIRI(line) ||
  LABEL_JAGO.test(line) ||
  LABEL_SEABANK.test(line) ||
  LABEL_BCA.test(line) ||
  LABEL_BRI.test(line) ||
  LABEL_GOPAY.test(line) ||
  LABEL_KET.test(line)

const isWatermark = (line: string) => isWatermarkBCA(line) || isWatermarkBRI(line)

const bersih = (line: string) =>
  line.replace(/[©®™]/g, '').replace(/\s+/g, ' ').trim()

function kosong(today: string, raw: string): Draft {
  return {
    date: today,
    payee: '',
    amount: null,
    source: '',
    note: '',
    raw,
    warnings: [],
  }
}

function ambilTanggal(lines: string[]): string | null {
  for (const line of lines) {
    const named = line.match(RE_TANGGAL)
    if (named) {
      const month = BULAN[named[2].slice(0, 3).toLowerCase()]
      if (month) {
        const day = named[1].replace(/[Oo]/g, '0').padStart(2, '0')
        const iso = `${named[3]}-${month}-${day}`
        if (isValidISODate(iso)) return iso
      }
    }
    const numeric = line.match(RE_TANGGAL_ANGKA)
    if (numeric) {
      const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3])
      const iso = `${year}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`
      if (isValidISODate(iso)) return iso
    }
  }
  return null
}

function ambilNominal(lines: string[]): number | null {
  const candidates = [
    lines.find((line) =>
      /total\s+transaksi|jumlah\s+transfer|transfer\s+amount|^nominal\b|^jumlah\b|^total\b/i.test(
        line,
      ),
    ),
    lines.find((line) => /^(?:Rp|IDR)\.?\s?[\d.,]+$/i.test(line)),
    lines.find((line) => RE_NOMINAL.test(line)),
  ]

  for (const line of candidates) {
    if (!line) continue
    const direct = line.match(RE_NOMINAL)
    if (direct) {
      const value = parseAmount(direct[1])
      if (value !== null) return value
    }
    const index = lines.indexOf(line)
    const next = lines[index + 1] ?? ''
    const below = next.match(RE_NOMINAL)
    if (below) {
      const value = parseAmount(below[1])
      if (value !== null) return value
    }
  }
  return null
}

function ambilKeterangan(lines: string[]): string | null {
  const clean = (value: string | undefined): string | null => {
    if (!value) return null
    return /^[-\u2013\u2014.]$/.test(value) ? null : value
  }

  for (let i = 0; i < lines.length; i += 1) {
    if (!LABEL_KET.test(lines[i])) continue
    const sameLine = clean(lines[i].replace(RE_KET_LABEL, '').trim())
    if (sameLine) return sameLine
    const next = lines[i + 1]
    if (
      !next ||
      isLabelUmum(next) ||
      isWatermark(next) ||
      /^bank\b/i.test(next) ||
      /^(?:Rp|IDR)/i.test(next)
    ) {
      continue
    }
    const value = clean(next.trim())
    if (value) return value
  }
  return null
}

function nilaiLabel(lines: string[], index: number, label: RegExp): string | null {
  const sameLine = lines[index].replace(label, '').replace(/^[:\s]+/, '').trim()
  if (sameLine) return sameLine
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (isWatermark(line)) continue
    if (isLabelUmum(line)) return null
    return line
  }
  return null
}

function nilaiLabelUmum(lines: string[], index: number): string | null {
  const sameLine = lines[index].replace(LABEL_PENERIMA_UMUM, '').replace(/^[:\s]+/, '').trim()
  if (sameLine) return sameLine
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (isWatermark(line)) continue
    if (isBankName(line) || isJagoAccount(line) || isJagoAmount(line) || isJagoStatus(line)) {
      continue
    }
    if (
      isLabelUmum(line) ||
      LABEL_PENERIMA_UMUM.test(line) ||
      LABEL_SUMBER_UMUM.test(line) ||
      /^(?:tanggal|waktu|jam)\b/i.test(line) ||
      /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line)
    ) {
      return null
    }
    return line
  }
  return null
}

function sumberDiTeks(lines: string[]): string {
  for (const line of lines) {
    const value = line.replace(/^(?:sumber\s+dana|source\s+of\s+fund)\s*[:\-]?\s*/i, '')
    const tokens = value.split(/\s+/)
    for (let i = 0; i < tokens.length; i += 1) {
      const match = matchSourceAt(tokens, i)
      if (match) return match.name
    }
  }
  return ''
}

const SUMBER_BANK: Record<BankKey, string> = {
  gopay: 'GoPay',
  jago: 'Jago',
  seabank: 'SeaBank',
  bca: 'BCA',
  bri: 'BRI',
  mandiri: 'Mandiri',
}

function parseGeneric(lines: string[], today: string, bank: BankKey | null): Draft {
  const draft = kosong(today, '')
  draft.date = ambilTanggal(lines) ?? today
  draft.amount = ambilNominal(lines)
  draft.note = ambilKeterangan(lines) ?? ''
  draft.source = sumberDiTeks(lines) || (bank ? SUMBER_BANK[bank] : '')

  const labelIndex = lines.findIndex((line) => LABEL_PENERIMA_UMUM.test(line))
  if (labelIndex > -1) draft.payee = nilaiLabelUmum(lines, labelIndex) ?? ''

  if (!draft.payee) {
    draft.payee =
      lines.find((line, index) => {
        if (index === 0 && !/^QR\s+\S/i.test(line)) return false
        if (!RE_NAMA_UMUM.test(line)) return false
        if (RE_BUKAN_NAMA.test(line)) return false
        if (isLabelUmum(line) || LABEL_PENERIMA_UMUM.test(line) || LABEL_SUMBER_UMUM.test(line)) {
          return false
        }
        if (/\d{4,}/.test(line)) return false
        if (/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line)) return false
        if (/(?:rp|idr)\s?[\d.,]+/i.test(line)) return false
        return true
      }) ?? ''
  }

  return draft
}

function parseMandiri(lines: string[], today: string): Draft {
  const draft = kosong(today, '')
  draft.date = ambilTanggal(lines) ?? today
  draft.amount = ambilNominal(lines)
  draft.note = ambilKeterangan(lines) ?? ''
  draft.source = 'Mandiri'

  const start = lines.findIndex((line) => LABEL_PENERIMA.test(line))
  if (start > -1) {
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (STOP_MANDIRI(line) || LABEL_KET.test(line)) break
      if (/^bank\b/i.test(line)) continue
      if (!draft.payee && RE_NAMA.test(line)) draft.payee = line
    }
  }

  if (!draft.payee) {
    const title = lines.findIndex((line) => /^transfer\s+berhasil\b/i.test(line))
    for (let i = title + 1; title > -1 && i < lines.length; i += 1) {
      const line = lines[i]
      if (
        /^(?:bank|total|detail|sumber|penerima)\b/i.test(line) ||
        isLabelUmum(line) ||
        isJagoAmount(line)
      ) {
        break
      }
      if (RE_NAMA.test(line)) {
        draft.payee = line
        break
      }
    }
  }
  return draft
}

function parseJago(lines: string[], today: string): Draft {
  const draft = kosong(today, '')
  draft.source = 'Jago'
  draft.date = ambilTanggal(lines) ?? today
  draft.amount = ambilNominal(lines)
  draft.note = ambilKeterangan(lines) ?? ''

  for (const label of LABEL_JAGO_PAYEE) {
    const index = lines.findIndex((line) => label.test(line))
    if (index === -1) continue
    draft.payee = namaJago(lines, index, label)
    if (draft.payee) break
  }

  if (!draft.payee) draft.payee = namaCadanganJago(lines)
  return draft
}

function parseSeaBank(lines: string[], today: string): Draft {
  const draft = kosong(today, '')
  draft.source = 'SeaBank'
  draft.date = ambilTanggal(lines) ?? today
  draft.amount = ambilNominal(lines)
  draft.note = ambilKeterangan(lines) ?? ''

  const label = lines.findIndex((line) => /^ke\b/i.test(line))
  if (label > -1) {
    draft.payee =
      nilaiLabel(lines, label, /^ke\b/i)?.replace(/^(?:o0|oo|oO|Oo)\s+/i, '').trim() ?? ''
  }
  return draft
}

function parseBCA(lines: string[], today: string): Draft {
  const draft = kosong(today, '')
  draft.source = 'BCA'
  draft.date = ambilTanggal(lines) ?? today
  draft.amount = ambilNominal(lines)
  draft.note = ambilKeterangan(lines) ?? ''

  const label = lines.findIndex((line) => /^beneficiary\s+name\b/i.test(line))
  if (label > -1) draft.payee = nilaiLabel(lines, label, /^beneficiary\s+name\b/i) ?? ''
  return draft
}

function parseBRI(lines: string[], today: string): Draft {
  const draft = kosong(today, '')
  draft.source = 'BRI'
  draft.date = ambilTanggal(lines) ?? today
  draft.amount = ambilNominal(lines)
  draft.note = ambilKeterangan(lines) ?? ''

  const label = lines.findIndex((line) => /^tujuan\b/i.test(line))
  if (label > -1) {
    for (let i = label + 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (!line || isWatermark(line)) continue
      if (isLabelUmum(line) || /^[\d\s*.-]{8,}$/.test(line)) break
      draft.payee = line
      break
    }
  }
  return draft
}

function parseGoPay(lines: string[], today: string): Draft {
  const draft = kosong(today, '')
  draft.source = 'GoPay'
  draft.date = ambilTanggal(lines) ?? today
  draft.amount = ambilNominal(lines)
  draft.note = ambilKeterangan(lines) ?? ''

  const label = lines.findIndex((line) => RE_PENERIMA_GOPAY.test(line))
  if (label > -1) {
    const match = lines[label].match(RE_PENERIMA_GOPAY)
    if (match?.[1]) draft.payee = match[1].trim()
  }
  if (!draft.payee) {
    const index = lines.findIndex((line) => /^(ditransfer|dibayar|dikirim)\s+ke$/i.test(line))
    if (index > -1) {
      draft.payee =
        nilaiLabel(lines, index, /^(ditransfer|dibayar|dikirim)\s+ke$/i) ?? ''
    }
  }
  return draft
}

type BankKey = 'gopay' | 'jago' | 'seabank' | 'bca' | 'bri' | 'mandiri'

function deteksiBank(lines: string[]): BankKey | null {
  const all = lines.join(' ')
  if (
    /gopay/i.test(all) &&
    /rincian\s+transaksi|ditransfer\s+ke|metode\s+pembayaran/i.test(all)
  ) {
    return 'gopay'
  }
  const jagoHeader =
    isLogoJago(lines[0] ?? '') ||
    (isLogoJago(lines[1] ?? '') && !isBankName(lines[0] ?? ''))
  const jagoAccount = /\bjago\s+\d{6,}\b/i.test(all)
  const bcaLabels = /beneficiary\s+name|transfer\s+amount|source\s+of\s+fund/i.test(all)
  if (
    /pan\s+merchant|nama\s+acquirer|tanggal\s*(&|dan)\s+waktu\s+transaksi/i.test(all) ||
    jagoHeader ||
    (jagoAccount && !bcaLabels)
  ) {
    return 'jago'
  }
  if (
    /seabank/i.test(all) &&
    /jumlah\s+transfer|metode\s+transaksi|waktu\s+transaksi|bukti\s+transaksi/i.test(all)
  ) {
    return 'seabank'
  }
  if (/beneficiary\s+name|transfer\s+amount|source\s+of\s+fund/i.test(all)) return 'bca'
  if (lines.some((line) => /^tujuan\b/i.test(line)) || /briva|brimo/i.test(all)) return 'bri'
  if (/livin|mandiri/i.test(all)) return 'mandiri'
  return null
}

export function parseReceipt(text: string, today = todayWIB()): ReceiptResult {
  const lines = text
    .split(/\r?\n/)
    .map(bersih)
    .filter(Boolean)
  const bank = deteksiBank(lines)
  const raw = text.trim()
  let draft = kosong(today, raw)

  if (bank === 'gopay') draft = parseGoPay(lines, today)
  else if (bank === 'jago') draft = parseJago(lines, today)
  else if (bank === 'seabank') draft = parseSeaBank(lines, today)
  else if (bank === 'bca') draft = parseBCA(lines, today)
  else if (bank === 'bri') draft = parseBRI(lines, today)
  else if (bank === 'mandiri') draft = parseMandiri(lines, today)
  else draft = parseGeneric(lines, today, bank)

  if (!bank) {
    draft.warnings.push('Format bank belum dikenali. Periksa semua field sebelum menyimpan.')
  }
  if (!ambilTanggal(lines)) {
    draft.warnings.push('Tanggal tidak terbaca, dipakai hari ini.')
  }
  if (!draft.payee) draft.warnings.push('Penerima tidak terbaca. Isi manual.')
  if (draft.amount === null) draft.warnings.push('Nominal tidak terbaca. Isi manual.')
  if (!draft.source) draft.warnings.push('Sumber dana tidak terbaca. Pilih manual.')

  return { ...draft, raw, teksMentah: raw, bank }
}
