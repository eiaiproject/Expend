export const SOURCES = [
  'Mandiri',
  'BCA',
  'BRI',
  'BNI',
  'Jago',
  'SeaBank',
  'GoPay',
  'OVO',
  'DANA',
  'ShopeePay',
  'Tunai',
] as const

const ALIASES: Record<string, string> = {
  mandiri: 'Mandiri',
  livin: 'Mandiri',
  'livin by mandiri': 'Mandiri',
  bca: 'BCA',
  'bank bca': 'BCA',
  bri: 'BRI',
  brimo: 'BRI',
  bni: 'BNI',
  jago: 'Jago',
  'bank jago': 'Jago',
  seabank: 'SeaBank',
  'sea bank': 'SeaBank',
  gopay: 'GoPay',
  'go pay': 'GoPay',
  ovo: 'OVO',
  dana: 'DANA',
  shopeepay: 'ShopeePay',
  'shopee pay': 'ShopeePay',
  tunai: 'Tunai',
  cash: 'Tunai',
}

function isAsciiAlphaNumeric(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  )
}

function cleanToken(token: string): string {
  let start = 0
  let end = token.length
  while (start < end && !isAsciiAlphaNumeric(token[start])) start += 1
  while (end > start && !isAsciiAlphaNumeric(token[end - 1])) end -= 1
  return token.slice(start, end).toLowerCase()
}

function collapseWhitespace(value: string): string {
  let result = ''
  let pendingSpace = false
  for (const char of value) {
    if (char.trim() === '') {
      pendingSpace = result.length > 0
      continue
    }
    if (pendingSpace) {
      result += ' '
      pendingSpace = false
    }
    result += char
  }
  return result
}

function stripTrailingPunctuation(value: string): string {
  let end = value.length
  while (end > 0 && '.,;:'.includes(value[end - 1])) end -= 1
  return value.slice(0, end)
}

export function canonicalSource(raw: string): string {
  const normalized = collapseWhitespace(raw.trim().toLowerCase())
  const key = stripTrailingPunctuation(normalized)
  return ALIASES[key] ?? raw.trim()
}

export function isKnownSource(raw: string): boolean {
  return (SOURCES as readonly string[]).includes(canonicalSource(raw))
}

export function matchSourceAt(
  tokens: string[],
  index: number,
): { name: string; length: 1 | 2 | 3 } | null {
  // Coba alias terpanjang lebih dulu agar "livin by mandiri" tidak berhenti di "livin".
  for (const length of [3, 2, 1] as const) {
    const parts = tokens.slice(index, index + length)
    if (parts.length !== length) continue
    const cleaned = parts.map(cleanToken)
    if (cleaned.some((token) => !token)) continue
    const name = ALIASES[cleaned.join(' ')]
    if (name) return { name, length }
  }
  return null
}
