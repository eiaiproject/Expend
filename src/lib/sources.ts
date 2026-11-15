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

function cleanToken(token: string): string {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
}

export function canonicalSource(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:]+$/g, '')
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
