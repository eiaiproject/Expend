import Dexie, { type Table } from 'dexie'

export interface Transaction {
  id?: number
  number: string
  date: string
  payee: string
  amount: number
  source: string
  note: string
  createdAt: number
}

class ExpendDB extends Dexie {
  transactions!: Table<Transaction, number>

  constructor() {
    super('expend')
    this.version(1).stores({
      transactions: '++id, number, date, amount, source, payee',
    })
    this.version(2).stores({
      transactions: '++id, &number, date, amount, source, payee, [date+source]',
    })
  }
}

export const db = new ExpendDB()

export function formatTransactionNumber(value: number): string {
  return `EXP-${String(value).padStart(6, '0')}`
}

export type TransactionDraft = Omit<Transaction, 'id' | 'number' | 'createdAt'>
export type TransactionInput = Omit<Transaction, 'id' | 'createdAt'>

export async function createTransaction(input: TransactionDraft): Promise<Transaction> {
  return db.transaction('rw', db.transactions, async () => {
    const used = new Set(
      (await db.transactions.orderBy('number').uniqueKeys()).map((value) => String(value)),
    )
    let candidate = 1
    while (used.has(formatTransactionNumber(candidate))) candidate += 1
    const record: Transaction = {
      ...input,
      number: formatTransactionNumber(candidate),
      createdAt: Date.now(),
    }
    const id = await db.transactions.add(record)
    return { ...record, id }
  })
}

export async function updateTransaction(id: number, input: TransactionDraft): Promise<void> {
  await db.transactions.update(id, input)
}

export async function deleteTransaction(id: number): Promise<void> {
  await db.transactions.delete(id)
}

export async function replaceAllTransactions(rows: TransactionInput[]): Promise<void> {
  await db.transaction('rw', db.transactions, async () => {
    await db.transactions.clear()
    const seen = new Set<string>()
    const now = Date.now()
    const records: Transaction[] = []
    for (const row of rows) {
      if (seen.has(row.number)) {
        throw new Error(`Nomor transaksi ganda: ${row.number}`)
      }
      seen.add(row.number)
      records.push({ ...row, createdAt: now })
    }
    await db.transactions.bulkAdd(records)
  })
}

function newestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return b.number.localeCompare(a.number)
}

function oldestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return a.number.localeCompare(b.number)
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const items = await db.transactions.toArray()
  return items.sort(newestFirst)
}

export async function getTransactionsBetween(
  start: string,
  end: string,
): Promise<Transaction[]> {
  if (start > end) return []
  const items = await db.transactions.where('date').between(start, end, true, true).toArray()
  return items.sort(newestFirst)
}

export async function getTransactionsOnDate(date: string): Promise<Transaction[]> {
  const items = await db.transactions.where('date').equals(date).toArray()
  return items.sort(oldestFirst)
}

export async function getRecentTransactions(limit: number): Promise<Transaction[]> {
  const items = await db.transactions.orderBy('date').reverse().limit(limit).toArray()
  return items.sort(oldestFirst)
}

export async function countTransactions(): Promise<number> {
  return db.transactions.count()
}

export async function getTransactionSources(): Promise<string[]> {
  const keys = await db.transactions.orderBy('source').uniqueKeys()
  return keys.map((value) => String(value)).sort()
}

export async function getSortedTransactions(): Promise<Transaction[]> {
  return getAllTransactions()
}

export async function requestPersistence(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const estimate = await navigator.storage.estimate()
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
  } catch {
    return null
  }
}
