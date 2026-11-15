import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil } from 'lucide-react'
import {
  countTransactions,
  getRecentTransactions,
  getTransactionsOnDate,
  type Transaction,
} from '../lib/db'
import { addDays, longDate, todayWIB } from '../lib/date'
import { formatIDR } from '../lib/money'

interface ChatFeedProps {
  onEdit: (transaction: Transaction) => void
  onViewAll: () => void
  highlightId?: number | null
  hideAmounts: boolean
}

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hari ini'
  if (date === addDays(today, -1)) return 'Kemarin'
  return longDate(date)
}

export function ChatFeed({ onEdit, onViewAll, highlightId, hideAmounts }: ChatFeedProps) {
  const today = todayWIB()
  const data = useLiveQuery(async () => {
    const [recent, todayItems, total] = await Promise.all([
      getRecentTransactions(14),
      getTransactionsOnDate(today),
      countTransactions(),
    ])
    return { recent, todayItems, total }
  }, [today])
  const endRef = useRef<HTMLSpanElement>(null)
  const previousCount = useRef<number | null>(null)

  useEffect(() => {
    if (!data) return
    const previous = previousCount.current
    previousCount.current = data.total
    if (previous === null || data.total > previous) {
      endRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [data])

  const todayItems = data?.todayItems ?? []
  const todayTotal = todayItems.reduce((total, item) => total + item.amount, 0)
  const recent = data?.recent ?? []

  const groups: Array<{ date: string; items: Transaction[] }> = []
  for (const item of recent) {
    const last = groups[groups.length - 1]
    if (last && last.date === item.date) last.items.push(item)
    else groups.push({ date: item.date, items: [item] })
  }

  return (
    <section className="chat-view" aria-labelledby="catat-title">
      <div className="page-head">
        <h1 id="catat-title">Catat</h1>
        <p>Satu baris, satu pengeluaran</p>
      </div>

      <div className="today-strip">
        <div className="today-main">
          <span className="today-label">Hari ini</span>
          <span className="today-amount mono">
            {data ? formatIDR(todayTotal, hideAmounts) : 'Memuat'}
          </span>
        </div>
        <span className="today-count">
          {data ? `${todayItems.length} transaksi` : ''}
        </span>
      </div>

      {data === undefined ? (
        <div className="chat-skeleton" aria-busy="true" aria-label="Memuat transaksi">
          <div className="skeleton skeleton-bubble" />
          <div className="skeleton skeleton-bubble short" />
        </div>
      ) : recent.length === 0 ? (
        <p className="chat-empty-line">Belum ada transaksi.</p>
      ) : (
        <div className="chat-feed">
          {groups.map((group) => (
            <div className="chat-day" key={group.date}>
              <p className="day-divider">
                <span>{dayLabel(group.date, today)}</span>
              </p>
              {group.items.map((transaction) => (
                <button
                  type="button"
                  className={`chat-bubble ${transaction.id === highlightId ? 'is-highlighted' : ''}`}
                  key={transaction.id}
                  onClick={() => onEdit(transaction)}
                  title="Ubah transaksi"
                >
                  <span className="bubble-top">
                    <span className="bubble-payee">{transaction.payee}</span>
                    <span className="bubble-amount mono">
                      {formatIDR(transaction.amount, hideAmounts)}
                    </span>
                  </span>
                  <span className="bubble-meta">
                    <span className="bubble-meta-text">
                      {transaction.source}
                      <span aria-hidden="true"> · </span>
                      <span className="mono">{transaction.number}</span>
                    </span>
                    <span className="bubble-edit">
                      <Pencil size={11} strokeWidth={1.75} aria-hidden="true" />
                      Ubah
                    </span>
                  </span>
                  {transaction.note ? (
                    <span className="bubble-note">{transaction.note}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}

          {(data?.total ?? 0) > recent.length ? (
            <button type="button" className="link chat-more" onClick={onViewAll}>
              Lihat semua {data?.total ?? 0} transaksi
            </button>
          ) : null}
        </div>
      )}

      <span ref={endRef} className="chat-end" aria-hidden="true" />
    </section>
  )
}
