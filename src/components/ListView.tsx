import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import {
  getAllTransactions,
  getTransactionSources,
  getTransactionsBetween,
  type Transaction,
} from '../lib/db'
import {
  addDays,
  longDate,
  monthEnd,
  monthStart,
  previousMonth,
  shiftMonths,
  shortDate,
  todayWIB,
} from '../lib/date'
import { formatIDR, parseAmount } from '../lib/money'
import { FilterSheet, type Sort } from './FilterSheet'
import { TransactionRow } from './TransactionRow'

type Period = 'this-month' | 'last-month' | 'three-months' | 'all' | 'custom'

interface Range {
  start: string
  end: string
}

interface Group {
  date: string
  items: Transaction[]
}

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'this-month', label: 'Bulan ini' },
  { id: 'last-month', label: 'Bulan lalu' },
  { id: 'three-months', label: '3 bulan' },
  { id: 'all', label: 'Semua' },
  { id: 'custom', label: 'Rentang' },
]

const FILTER_KEY = 'expend-list-filters'
const PAGE_SIZE = 100

interface SavedFilters {
  query: string
  period: Period
  from: string
  to: string
  source: string
  sort: Sort
  allDates: boolean
}

interface ListViewProps {
  readonly onEdit: (transaction: Transaction) => void
  readonly hideAmounts: boolean
}

interface ListToolbarProps {
  readonly query: string
  readonly hasQuery: boolean
  readonly period: Period
  readonly from: string
  readonly to: string
  readonly today: string
  readonly activeFilters: number
  readonly allDates: boolean
  readonly noResults: boolean
  readonly onQuery: (value: string) => void
  readonly onOpenFilter: () => void
  readonly onPeriod: (period: Period) => void
  readonly onFrom: (value: string) => void
  readonly onTo: (value: string) => void
  readonly onToggleAllDates: () => void
}

interface ListContentProps {
  readonly filtered: Transaction[] | null
  readonly grouped: Group[]
  readonly today: string
  readonly hasQuery: boolean
  readonly source: string
  readonly period: Period
  readonly allDates: boolean
  readonly visible: number
  readonly hideAmounts: boolean
  readonly onEdit: (transaction: Transaction) => void
  readonly onSearchAll: () => void
  readonly onReset: () => void
  readonly onMore: () => void
}

function loadFilters(): Partial<SavedFilters> {
  try {
    const raw = window.sessionStorage.getItem(FILTER_KEY)
    if (!raw) return {}
    const saved = JSON.parse(raw) as Partial<SavedFilters>
    const text = (value: unknown) => (typeof value === 'string' ? value : '')
    const date = (value: unknown) =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
    const query = text(saved.query)
    return {
      query,
      period: PERIODS.some((item) => item.id === saved.period)
        ? (saved.period as Period)
        : 'this-month',
      from: date(saved.from),
      to: date(saved.to),
      source: text(saved.source) || 'all',
      sort: ['newest', 'oldest', 'highest', 'lowest'].includes(saved.sort ?? '')
        ? (saved.sort as Sort)
        : 'newest',
      allDates: Boolean(saved.allDates && query.trim()),
    }
  } catch {
    return {}
  }
}

function rangeFor(period: Period, from: string, to: string, today: string): Range | null {
  if (period === 'this-month') return { start: monthStart(today), end: monthEnd(today) }
  if (period === 'last-month') {
    const previous = previousMonth(today)
    return { start: monthStart(previous), end: monthEnd(previous) }
  }
  if (period === 'three-months') return { start: shiftMonths(today, -2), end: monthEnd(today) }
  if (period === 'custom') {
    return { start: from || '0000-01-01', end: to || '9999-12-31' }
  }
  return null
}

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hari ini'
  if (date === addDays(today, -1)) return 'Kemarin'
  return longDate(date)
}

function matchesSearch(item: Transaction, needle: string, numeric: number | null): boolean {
  if (!needle) return true
  const values = [item.number, item.payee, item.note, item.source]
  if (values.some((value) => value.toLowerCase().includes(needle))) return true
  return numeric !== null && item.amount === numeric
}

function compareTransactions(a: Transaction, b: Transaction, sort: Sort): number {
  if (sort === 'highest') return b.amount - a.amount || b.date.localeCompare(a.date)
  if (sort === 'lowest') return a.amount - b.amount || b.date.localeCompare(a.date)
  if (sort === 'oldest') {
    return a.date === b.date ? a.number.localeCompare(b.number) : a.date.localeCompare(b.date)
  }
  return a.date === b.date ? b.number.localeCompare(a.number) : b.date.localeCompare(a.date)
}

function filterTransactions(
  items: Transaction[],
  query: string,
  allDates: boolean,
  period: Period,
  from: string,
  to: string,
  source: string,
  sort: Sort,
  today: string,
): Transaction[] {
  const needle = query.trim().toLowerCase()
  const numeric = parseAmount(query)
  const range = allDates && needle ? null : rangeFor(period, from, to, today)

  return items
    .filter((item) => {
      if (range && (item.date < range.start || item.date > range.end)) return false
      if (source !== 'all' && item.source !== source) return false
      return matchesSearch(item, needle, numeric)
    })
    .sort((a, b) => compareTransactions(a, b, sort))
}

function groupTransactions(items: Transaction[], sort: Sort): Group[] {
  if (sort === 'highest' || sort === 'lowest') {
    return [{ date: '', items }]
  }

  const groups: Group[] = []
  for (const item of items) {
    const last = groups.at(-1)
    if (last && last.date === item.date) last.items.push(item)
    else groups.push({ date: item.date, items: [item] })
  }
  return groups
}

function customRangeLabel(period: Period, from: string, to: string): string {
  if (period !== 'custom') return ''
  if (from && to) return `${shortDate(from)} sampai ${shortDate(to)}`
  if (from) return `dari ${shortDate(from)}`
  if (to) return `sampai ${shortDate(to)}`
  return ''
}

function summarySuffix(
  summaryRange: string,
  range: Range | null,
  allDates: boolean,
  period: Period,
): string {
  if (summaryRange) return ` · ${summaryRange}`
  if (range && !allDates && period !== 'custom') {
    return ` · ${shortDate(range.start)} sampai ${shortDate(range.end)}`
  }
  return ''
}

function emptyMessage(hasQuery: boolean, source: string, period: Period): string {
  if (hasQuery || source !== 'all' || period !== 'this-month') {
    return 'Tidak ada transaksi yang cocok dengan pencarian atau filter ini.'
  }
  return 'Belum ada transaksi pada periode ini.'
}

function ListToolbar({
  query,
  hasQuery,
  period,
  from,
  to,
  today,
  activeFilters,
  allDates,
  noResults,
  onQuery,
  onOpenFilter,
  onPeriod,
  onFrom,
  onTo,
  onToggleAllDates,
}: ListToolbarProps) {
  return (
    <div className="list-toolbar">
      <div className="search-line">
        <div className="search">
          <Search size={17} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Cari penerima atau nominal"
            aria-label="Cari transaksi"
            onChange={(event) => onQuery(event.target.value)}
          />
          {hasQuery ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => onQuery('')}
              aria-label="Hapus pencarian"
            >
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="filter-btn"
          onClick={onOpenFilter}
          aria-label={activeFilters > 0 ? `Buka filter, ${activeFilters} aktif` : 'Buka filter'}
        >
          <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
          {activeFilters > 0 ? <span className="filter-count">{activeFilters}</span> : null}
        </button>
      </div>

      <fieldset className="chip-row" aria-label="Periode">
        {PERIODS.map((item) => (
          <button
            type="button"
            className="chip"
            key={item.id}
            aria-pressed={period === item.id}
            onClick={() => onPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </fieldset>

      {period === 'custom' ? (
        <div className="date-range">
          <span className="date-field">
            <label htmlFor="filter-from">Dari</label>
            <input
              id="filter-from"
              type="date"
              value={from}
              max={to || today}
              onChange={(event) => onFrom(event.target.value)}
            />
          </span>
          <span className="date-field">
            <label htmlFor="filter-to">Sampai</label>
            <input
              id="filter-to"
              type="date"
              value={to}
              min={from || undefined}
              max={today}
              onChange={(event) => onTo(event.target.value)}
            />
          </span>
        </div>
      ) : null}

      {hasQuery && period !== 'all' && !noResults ? (
        <button
          type="button"
          className="chip chip-wide"
          aria-pressed={allDates}
          onClick={onToggleAllDates}
        >
          Cari di semua tanggal
        </button>
      ) : null}
    </div>
  )
}

function ListContent({
  filtered,
  grouped,
  today,
  hasQuery,
  source,
  period,
  allDates,
  visible,
  hideAmounts,
  onEdit,
  onSearchAll,
  onReset,
  onMore,
}: ListContentProps) {
  if (filtered === null) {
    return (
      <div className="skeleton-list" aria-busy="true" aria-label="Memuat transaksi">
        {[0, 1, 2, 3].map((item) => (
          <div className="skeleton" key={item} />
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="empty-card">
        <p>{emptyMessage(hasQuery, source, period)}</p>
        <div className="empty-actions">
          {hasQuery && !allDates && period !== 'all' ? (
            <button type="button" className="btn btn-small" onClick={onSearchAll}>
              Cari di semua tanggal
            </button>
          ) : null}
          <button type="button" className="btn btn-small" onClick={onReset}>
            Atur ulang filter
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="day-groups">
        {grouped.map((group) => (
          <section className="day-group" key={group.date || 'nominal'}>
            <h2 className="day-label">
              {group.date ? dayLabel(group.date, today) : 'Diurutkan nominal'}
            </h2>
            <ul className="list-card">
              {group.items.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onEdit={onEdit}
                  hideAmounts={hideAmounts}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {filtered.length > visible ? (
        <button type="button" className="btn btn-block load-more" onClick={onMore}>
          Muat {Math.min(PAGE_SIZE, filtered.length - visible)} transaksi lagi
        </button>
      ) : null}
    </>
  )
}

export function ListView({ onEdit, hideAmounts }: ListViewProps) {
  const today = todayWIB()
  const [saved] = useState(loadFilters)
  const [query, setQuery] = useState(saved.query ?? '')
  const [period, setPeriod] = useState<Period>(saved.period ?? 'this-month')
  const [from, setFrom] = useState(saved.from ?? '')
  const [to, setTo] = useState(saved.to ?? '')
  const [source, setSource] = useState(saved.source ?? 'all')
  const [sort, setSort] = useState<Sort>(saved.sort ?? 'newest')
  const [allDates, setAllDates] = useState(saved.allDates ?? false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const hasQuery = query.trim().length > 0
  const searchAll = allDates && hasQuery

  const data = useLiveQuery(async () => {
    const range = searchAll ? null : rangeFor(period, from, to, today)
    const [items, sources] = await Promise.all([
      range ? getTransactionsBetween(range.start, range.end) : getAllTransactions(),
      getTransactionSources(),
    ])
    return { items, sources }
  }, [period, from, to, today, searchAll])

  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [query, period, from, to, source, sort, allDates])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        FILTER_KEY,
        JSON.stringify({ query, period, from, to, source, sort, allDates }),
      )
    } catch {
      // Session storage tidak tersedia; filter tetap berjalan di memori.
    }
  }, [query, period, from, to, source, sort, allDates])

  const sources = data?.sources ?? []

  const filtered = useMemo(
    () =>
      data
        ? filterTransactions(
            data.items,
            query,
            allDates,
            period,
            from,
            to,
            source,
            sort,
            today,
          )
        : null,
    [data, query, allDates, period, from, to, source, sort, today],
  )

  const grouped = useMemo(
    () => groupTransactions(filtered?.slice(0, visible) ?? [], sort),
    [filtered, sort, visible],
  )

  const total = (filtered ?? []).reduce((sum, item) => sum + item.amount, 0)
  const noResults = filtered !== null && filtered.length === 0
  const range = rangeFor(period, from, to, today)
  const activeFilters = (source !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0)
  const customRange = customRangeLabel(period, from, to)
  const summaryRange = allDates && hasQuery ? 'semua tanggal' : customRange
  const suffix = summarySuffix(summaryRange, range, allDates, period)

  const choosePeriod = (next: Period) => {
    setPeriod(next)
    setAllDates(false)
  }

  const changeQuery = (value: string) => {
    setQuery(value)
    if (!value.trim()) setAllDates(false)
  }

  const changeFrom = (value: string) => {
    setFrom(value)
    setAllDates(false)
  }

  const changeTo = (value: string) => {
    setTo(value)
    setAllDates(false)
  }

  const resetFilters = () => {
    setQuery('')
    setPeriod('this-month')
    setFrom('')
    setTo('')
    setSource('all')
    setSort('newest')
    setAllDates(false)
  }

  return (
    <section className="page list-page" aria-labelledby="list-title">
      <div className="page-head">
        <h1 id="list-title">Daftar</h1>
        <p>Cari, saring, lalu buka untuk mengubah</p>
      </div>

      <ListToolbar
        query={query}
        hasQuery={hasQuery}
        period={period}
        from={from}
        to={to}
        today={today}
        activeFilters={activeFilters}
        allDates={allDates}
        noResults={noResults}
        onQuery={changeQuery}
        onOpenFilter={() => setFilterOpen(true)}
        onPeriod={choosePeriod}
        onFrom={changeFrom}
        onTo={changeTo}
        onToggleAllDates={() => setAllDates((value) => !value)}
      />

      <div className="list-summary">
        <span>{filtered ? `${filtered.length} transaksi${suffix}` : 'Memuat...'}</span>
        <span className="mono">{formatIDR(total, hideAmounts)}</span>
      </div>

      <ListContent
        filtered={filtered}
        grouped={grouped}
        today={today}
        hasQuery={hasQuery}
        source={source}
        period={period}
        allDates={allDates}
        visible={visible}
        hideAmounts={hideAmounts}
        onEdit={onEdit}
        onSearchAll={() => setAllDates(true)}
        onReset={resetFilters}
        onMore={() => setVisible((value) => value + PAGE_SIZE)}
      />

      {filterOpen ? (
        <FilterSheet
          source={source}
          sort={sort}
          sources={sources}
          onSource={setSource}
          onSort={setSort}
          onReset={() => {
            setSource('all')
            setSort('newest')
          }}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}
    </section>
  )
}
