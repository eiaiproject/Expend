const WIB = 'Asia/Jakarta'

export function todayWIB(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const date = parseISODate(iso)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function daysInMonth(iso: string): number {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function monthEnd(iso: string): string {
  return `${iso.slice(0, 7)}-${String(daysInMonth(iso)).padStart(2, '0')}`
}

export function previousMonth(iso: string): string {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  const date = new Date(Date.UTC(year, month - 2, 1))
  return date.toISOString().slice(0, 10)
}

export function shiftMonths(iso: string, months: number): string {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  const date = new Date(Date.UTC(year, month - 1 + months, 1))
  return date.toISOString().slice(0, 10)
}

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(parseISODate(iso))
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseISODate(iso))
}

export function monthShort(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    timeZone: 'UTC',
  }).format(parseISODate(iso))
}

export function monthYear(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseISODate(iso))
}

export function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10))
}
