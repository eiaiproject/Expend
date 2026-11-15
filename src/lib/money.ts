export const MAX_AMOUNT = 999_999_999_999

function toNumber(raw: string): number {
  const comma = raw.lastIndexOf(',')
  const dot = raw.lastIndexOf('.')
  if (comma > -1 && dot > -1) {
    return Number(dot > comma ? raw.replace(/,/g, '') : raw.replace(/\./g, '').replace(',', '.'))
  }
  if (dot > -1) {
    return Number(raw.slice(dot + 1).length === 3 ? raw.replace(/\./g, '') : raw)
  }
  if (comma > -1) {
    return Number(raw.slice(comma + 1).length === 3 ? raw.replace(/,/g, '') : raw.replace(',', '.'))
  }
  return Number(raw)
}

export function parseAmount(input: string): number | null {
  let value = input.trim().toLowerCase().replace(/\s+/g, '')
  value = value.replace(/^rp\.?/, '').replace(/^idr\.?/, '')
  if (!value) return null

  const suffix = value.match(/^(\d+(?:[.,]\d+)?)(rb|ribu|k|jt|juta)$/)
  if (suffix) {
    const base = toNumber(suffix[1])
    if (!Number.isFinite(base)) return null
    const multiplier = suffix[2] === 'jt' || suffix[2] === 'juta' ? 1_000_000 : 1_000
    return Math.round(base * multiplier)
  }

  if (!/^\d[\d.,]*$/.test(value)) return null
  const parsed = toNumber(value)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed)
}

const numberFormatter = new Intl.NumberFormat('id-ID')

export const HIDDEN_AMOUNT = '•••••'

export function formatIDR(value: number, hidden = false): string {
  return hidden ? HIDDEN_AMOUNT : `Rp ${numberFormatter.format(value)}`
}

export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}
