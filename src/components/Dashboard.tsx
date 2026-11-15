import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChartColumn } from 'lucide-react'
import {
  countTransactions,
  getTransactionsBetween,
  type Transaction,
} from '../lib/db'
import {
  addDays,
  dayOfMonth,
  daysInMonth,
  monthShort,
  monthStart,
  monthYear,
  parseISODate,
  previousMonth,
  shiftMonths,
  shortDate,
  todayWIB,
} from '../lib/date'
import { formatIDR, formatSignedPercent } from '../lib/money'

interface Bar {
  label: string
  value: number
  hint: string
}

type ChartMode = 'daily' | 'weekly' | 'monthly'

const MODES: Array<{ id: ChartMode; label: string }> = [
  { id: 'daily', label: 'Harian' },
  { id: 'weekly', label: 'Mingguan' },
  { id: 'monthly', label: 'Bulanan' },
]

function sumAmount(items: Transaction[]): number {
  return items.reduce((total, item) => total + item.amount, 0)
}

function startOf(monthIso: string, day: number): string {
  return `${monthIso.slice(0, 7)}-${String(day).padStart(2, '0')}`
}

function BarChart({
  bars,
  label,
  selected,
  onSelect,
  hideAmounts,
}: {
  bars: Bar[]
  label: string
  selected: number
  onSelect: (index: number) => void
  hideAmounts: boolean
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.value))
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    itemsRef.current[selected]?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selected, bars.length])

  const focusBar = (index: number) => {
    const next = Math.max(0, Math.min(bars.length - 1, index))
    onSelect(next)
    requestAnimationFrame(() => itemsRef.current[next]?.focus())
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusBar(index + 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusBar(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusBar(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusBar(bars.length - 1)
    }
  }

  return (
    <div className="chart" role="group" aria-label={label}>
      <div className="chart-bars">
        {bars.map((bar, index) => (
          <button
            type="button"
            key={`${bar.hint}-${index}`}
            ref={(node) => {
              itemsRef.current[index] = node
            }}
            className={`chart-slot ${index === selected ? 'is-selected' : ''}`}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            tabIndex={index === selected ? 0 : -1}
            aria-pressed={index === selected}
            aria-label={`${bar.hint}: ${formatIDR(bar.value, hideAmounts)}`}
          >
            <span className="chart-track">
              {bar.value > 0 ? (
                <span
                  className="chart-bar"
                  style={{ height: `${Math.max(4, (bar.value / max) * 100)}%` }}
                />
              ) : null}
            </span>
            <span className="chart-label">{bar.label || '\u00A0'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Dashboard({
  onGoToComposer,
  hideAmounts,
}: {
  onGoToComposer: () => void
  hideAmounts: boolean
}) {
  const today = todayWIB()
  const data = useLiveQuery(async () => {
    const start = monthStart(today)
    const currentDay = dayOfMonth(today)
    const previousStart = previousMonth(today)
    const previousEnd = startOf(previousStart, Math.min(currentDay, daysInMonth(previousStart)))
    const sixMonthStart = shiftMonths(today, -5)
    const [monthItems, previousItems, sixMonthItems, totalCount] = await Promise.all([
      getTransactionsBetween(start, today),
      getTransactionsBetween(previousStart, previousEnd),
      getTransactionsBetween(sixMonthStart, today),
      countTransactions(),
    ])
    return { monthItems, previousItems, sixMonthItems, totalCount }
  }, [today])
  const [mode, setMode] = useState<ChartMode>('daily')
  const [selected, setSelected] = useState<number | null>(null)

  const stats = useMemo(() => {
    if (!data) return null

    const start = monthStart(today)
    const currentDay = dayOfMonth(today)
    const { monthItems, previousItems, sixMonthItems, totalCount } = data
    const total = sumAmount(monthItems)

    const previousStart = previousMonth(today)
    const previousDay = Math.min(currentDay, daysInMonth(previousStart))
    const previousEnd = startOf(previousStart, previousDay)
    const previousTotal = sumAmount(previousItems)

    const daily: Bar[] = Array.from({ length: currentDay }, (_, index) => {
      const day = index + 1
      const date = startOf(start, day)
      return {
        label: day === 1 || day % 5 === 0 || day === currentDay ? String(day) : '',
        value: sumAmount(monthItems.filter((item) => item.date === date)),
        hint: shortDate(date),
      }
    })

    const weekly: Bar[] = []
    const weekday = parseISODate(start).getUTCDay()
    let cursor = addDays(start, -((weekday + 6) % 7))
    while (cursor <= today) {
      const weekStart = cursor < start ? start : cursor
      const rawEnd = addDays(cursor, 6)
      const weekEnd = rawEnd > today ? today : rawEnd
      const fromDay = dayOfMonth(weekStart)
      const toDay = dayOfMonth(weekEnd)
      weekly.push({
        label: fromDay === toDay ? String(fromDay) : `${fromDay}-${toDay}`,
        value: sumAmount(
          monthItems.filter((item) => item.date >= weekStart && item.date <= weekEnd),
        ),
        hint: `${shortDate(weekStart)} sampai ${shortDate(weekEnd)}`,
      })
      cursor = addDays(cursor, 7)
    }

    const monthly: Bar[] = Array.from({ length: 6 }, (_, index) => {
      const month = shiftMonths(today, index - 5)
      const end =
        index === 5
          ? today
          : `${month.slice(0, 7)}-${String(daysInMonth(month)).padStart(2, '0')}`
      return {
        label: monthShort(month),
        value: sumAmount(
          sixMonthItems.filter((item) => item.date >= month && item.date <= end),
        ),
        hint: monthYear(month),
      }
    })

    return {
      total,
      count: monthItems.length,
      previousTotal,
      previousLabel: `${shortDate(previousStart)} sampai ${shortDate(previousEnd)}`,
      daily,
      weekly,
      monthly,
      rangeLabel: `${shortDate(start)} sampai ${shortDate(today)}`,
      monthLabel: monthYear(today),
      empty: totalCount === 0,
    }
  }, [data, today])

  if (!stats) {
    return (
      <section className="page dashboard" aria-labelledby="dashboard-title">
        <div className="page-head">
          <h1 id="dashboard-title">Dasbor</h1>
          <p>Ringkasan bulan berjalan</p>
        </div>
        <div className="hero-card skeleton skeleton-hero" aria-busy="true" aria-label="Memuat ringkasan" />
      </section>
    )
  }

  if (stats.empty) {
    return (
      <section className="page dashboard" aria-labelledby="dashboard-title">
        <div className="page-head">
          <h1 id="dashboard-title">Dasbor</h1>
          <p>{stats.monthLabel} · sampai hari ini</p>
        </div>
        <div className="empty-card empty-dashboard">
          <span className="empty-mark">
            <ChartColumn size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p>Belum ada transaksi, jadi belum ada yang bisa dihitung.</p>
          <button type="button" className="btn btn-primary" onClick={onGoToComposer}>
            Catat pengeluaran pertama
          </button>
        </div>
      </section>
    )
  }

  const bars =
    mode === 'daily' ? stats.daily : mode === 'weekly' ? stats.weekly : stats.monthly
  const activeIndex =
    selected !== null && selected < bars.length ? selected : bars.length - 1
  const activeBar = bars[activeIndex] ?? bars[0]

  const comparison =
    stats.previousTotal === 0
      ? 'Belum ada pembanding pada periode yang sama bulan lalu.'
      : `${formatSignedPercent(((stats.total - stats.previousTotal) / stats.previousTotal) * 100)} dari ${formatIDR(stats.previousTotal, hideAmounts)} pada ${stats.previousLabel}.`

  const caption =
    mode === 'daily'
      ? stats.rangeLabel
      : mode === 'weekly'
        ? 'Minggu mulai Senin, dipotong ke bulan berjalan'
        : 'Enam bulan terakhir, bulan ini sampai hari ini'

  return (
    <section className="page dashboard" aria-labelledby="dashboard-title">
      <div className="page-head">
        <h1 id="dashboard-title">Dasbor</h1>
        <p>{stats.monthLabel} · sampai hari ini</p>
      </div>

      <div className="hero-card">
        <p className="stat-label">Pengeluaran bulan ini</p>
        <p className="stat-figure mono">{formatIDR(stats.total, hideAmounts)}</p>
        <p className="stat-meta">
          {stats.count} transaksi · {stats.rangeLabel}
        </p>
        <p className="hero-compare">{comparison}</p>
      </div>

      <div className="chart-card">
        <div className="segmented" role="group" aria-label="Pilih periode grafik">
          {MODES.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={mode === item.id}
              onClick={() => {
                setMode(item.id)
                setSelected(null)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="chart-readout" aria-live="polite">
          <span>{activeBar.hint}</span>
          <strong className="mono">{formatIDR(activeBar.value, hideAmounts)}</strong>
        </div>

        <BarChart
          bars={bars}
          label={`Pengeluaran ${mode === 'daily' ? 'harian' : mode === 'weekly' ? 'mingguan' : 'bulanan'}`}
          selected={activeIndex}
          onSelect={setSelected}
          hideAmounts={hideAmounts}
        />

        <p className="chart-caption">{caption}</p>
      </div>
    </section>
  )
}
