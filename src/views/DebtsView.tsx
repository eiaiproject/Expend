import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Handshake, HelpCircle, Plus, Search, X } from 'reicon-react';
import { db, type Debt, type DebtPayment, type Wallet } from '../db/db';
import { DebtCard } from '../components/debts/DebtCard';
import { DebtDetailSheet } from '../components/debts/DebtDetailSheet';
import { DebtFormSheet } from '../components/debts/DebtFormSheet';
import { DebtPaymentSheet } from '../components/debts/DebtPaymentSheet';
import { Skeleton } from '../components/Skeleton';
import { usePrivacy } from '../contexts/PrivacyContext';
import { buildDebtPaymentsMap, calculateDebtStatus, summarizeDebts } from '../services/debtService';
import { getTodayStr } from '../utils/dateUtils';
import { formatCurrency, formatBalance } from '../utils/formatUtils';
import { cn } from '../utils/cn';
import { EmptyState } from '../components/EmptyState';

type DebtTypeFilter = 'all' | 'payable' | 'receivable';
type DebtStatusFilter = 'all' | 'active' | 'due_soon' | 'overdue' | 'settled';
type DebtSort = 'due_soon' | 'most_overdue' | 'highest' | 'lowest' | 'newest' | 'name';

const EMPTY_DEBTS: Debt[] = [];
const EMPTY_PAYMENTS: DebtPayment[] = [];
const EMPTY_WALLETS: Wallet[] = [];

function buildWalletMap(wallets: readonly Wallet[]): Record<number, Wallet | undefined> {
  return wallets.reduce<Record<number, Wallet | undefined>>((acc, wallet) => {
    if (wallet.id != null) acc[wallet.id] = wallet;
    return acc;
  }, {});
}

function matchesFilters(
  debt: Debt,
  paymentsByDebt: Record<string, readonly DebtPayment[]>,
  typeFilter: DebtTypeFilter,
  statusFilter: DebtStatusFilter,
  today: string,
): boolean {
  if (typeFilter !== 'all' && debt.type !== typeFilter) return false;

  const status = calculateDebtStatus(debt, paymentsByDebt[debt.id] ?? [], today);
  if (statusFilter === 'all') return true;
  if (statusFilter === 'overdue') return status === 'overdue';
  if (statusFilter === 'settled') return status === 'paid' || status === 'written_off';
  if (statusFilter === 'active') return status === 'open' || status === 'partial';
  if (statusFilter === 'due_soon') {
    if (status === 'overdue' || status === 'paid' || status === 'written_off') return false;
    const weekAhead = addDaysStr(today, 7);
    return !!debt.dueDate && debt.dueDate >= today && debt.dueDate <= weekAhead;
  }
  return true;
}

function addDaysStr(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  const y = Number(parts[0]!);
  const m = Number(parts[1]!);
  const d = Number(parts[2]!);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return getTodayStr(date);
}

function sortDebts(
  debts: readonly Debt[],
  paymentsByDebt: Record<string, readonly DebtPayment[]>,
  sortBy: DebtSort,
  today: string,
): Debt[] {
  const sorted = [...debts];
  switch (sortBy) {
    case 'due_soon':
      return sorted.sort((a, b) => {
        const aDue = a.dueDate ?? '9999-12-31';
        const bDue = b.dueDate ?? '9999-12-31';
        return aDue.localeCompare(bDue);
      });
    case 'most_overdue':
      return sorted.sort((a, b) => {
        const aDays = a.dueDate ? Math.max(0, today.localeCompare(a.dueDate)) : 0;
        const bDays = b.dueDate ? Math.max(0, today.localeCompare(b.dueDate)) : 0;
        return bDays - aDays;
      });
    case 'highest':
      return sorted.sort((a, b) => b.remainingAmount - a.remainingAmount);
    case 'lowest':
      return sorted.sort((a, b) => a.remainingAmount - b.remainingAmount);
    case 'newest':
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'name':
      return sorted.sort((a, b) => a.personName.localeCompare(b.personName));
    default:
      return sorted;
  }
}

function searchDebt(debt: Debt, searchTerm: string, includeAmounts: boolean): boolean {
  if (!searchTerm.trim()) return true;
  const query = searchTerm.trim().toLowerCase();
  const values = [debt.personName, debt.title ?? '', debt.notes ?? ''];
  if (includeAmounts) {
    values.push(
      debt.principalAmount.toString(),
      debt.principalAmount.toLocaleString('id-ID'),
      debt.remainingAmount.toString(),
      debt.remainingAmount.toLocaleString('id-ID'),
    );
  }
  return values.some((value) => value.toLowerCase().includes(query));
}

export default function DebtsView() {
  const { t } = useTranslation();
  const { hideAmount } = usePrivacy();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<DebtTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<DebtStatusFilter>('all');
  const [sortBy, setSortBy] = useState<DebtSort>('due_soon');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [debtToEdit, setDebtToEdit] = useState<Debt | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const debts = useLiveQuery(() => db.debts.toArray(), [], undefined);
  const payments = useLiveQuery(() => db.debtPayments.toArray(), [], undefined);
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], undefined);

  useEffect(() => {
    const initDefaultWallet = async () => {
      const walletCount = await db.wallets.count();
      if (walletCount === 0) {
        await db.wallets.add({
          name: 'Main Wallet',
          currency: 'IDR',
          initialBalance: 0,
          currentBalance: 0,
          lastUpdated: new Date().toISOString(),
        });
      }
    };
    initDefaultWallet();
  }, []);

  const isLoading = debts === undefined || payments === undefined || wallets === undefined;
  const safeDebts = debts ?? EMPTY_DEBTS;
  const safePayments = payments ?? EMPTY_PAYMENTS;
  const safeWallets = wallets ?? EMPTY_WALLETS;
  const paymentsByDebt = useMemo(() => buildDebtPaymentsMap(safePayments), [safePayments]);
  const walletMap = useMemo(() => buildWalletMap(safeWallets), [safeWallets]);
  const today = useMemo(() => getTodayStr(), []);
  const summary = useMemo(() => summarizeDebts(safeDebts, paymentsByDebt, today), [safeDebts, paymentsByDebt, today]);
  const activeSelectedDebt = useMemo(
    () => selectedDebt ? (safeDebts.find((debt) => debt.id === selectedDebt.id) ?? selectedDebt) : null,
    [safeDebts, selectedDebt],
  );

  const filteredDebts = useMemo(() => {
    const visibleDebts = safeDebts.filter((debt) => !debt.archivedAt);
    const matched = visibleDebts.filter(
      (debt) => matchesFilters(debt, paymentsByDebt, typeFilter, statusFilter, today) && searchDebt(debt, searchTerm, !hideAmount),
    );
    return sortDebts(matched, paymentsByDebt, sortBy, today);
  }, [typeFilter, statusFilter, sortBy, hideAmount, paymentsByDebt, safeDebts, searchTerm, today]);

  const hasAnyDebt = safeDebts.some((debt) => !debt.archivedAt);
  const hasFilters = typeFilter !== 'all' || statusFilter !== 'all';

  const handleOpenForm = () => {
    setDebtToEdit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (debt: Debt) => {
    setSelectedDebt(null);
    setDebtToEdit(debt);
    setIsFormOpen(true);
  };

  const handlePayment = (debt: Debt) => {
    setSelectedDebt(null);
    setPaymentDebt(debt);
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
  };

  const typeFilters: Array<{ id: DebtTypeFilter; label: string }> = [
    { id: 'all', label: t('debt.typeAll') },
    { id: 'payable', label: t('debt.typePayable') },
    { id: 'receivable', label: t('debt.typeReceivable') },
  ];

  const statusFilters: Array<{ id: DebtStatusFilter; label: string }> = [
    { id: 'active', label: t('debt.statusActive') },
    { id: 'due_soon', label: t('debt.statusDueSoon') },
    { id: 'overdue', label: t('debt.statusOverdue') },
    { id: 'settled', label: t('debt.statusSettled') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('Debts & Receivables')}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]"
            aria-label={t('debt.helpLabel')}
            aria-expanded={showHelp}
          >
            <HelpCircle size={20} />
          </button>
          <button
            type="button"
            onClick={handleOpenForm}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20"
            aria-label={t('debt.recordLabel')}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div className="rounded-[16px] border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4" role="region" aria-label={t('debt.helpTitle')}> {/* NOSONAR: S6819 — landmark region */}
          <h2 className="mb-2 font-bold text-[var(--accent)]">{t('debt.helpTitle')}</h2>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <li key={`help-${i}`}>• {t(`debt.helpBullet${i}`)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{t('debt.summaryTitle')}</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('debt.notInWallet')}</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold">{t('debt.youOwe')}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t('debt.youOweDesc')}</p>
            </div>
            <p className="shrink-0 font-mono font-bold text-amber-500">{formatCurrency(summary.payableTotal, hideAmount)}</p>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold">{t('debt.owedToYou')}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t('debt.owedToYouDesc')}</p>
            </div>
            <p className="shrink-0 font-mono font-bold text-[var(--accent)]">{formatCurrency(summary.receivableTotal, hideAmount)}</p>
          </div>
          <div className="border-t border-[var(--border)] pt-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold">{t('debt.netPosition')}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t('debt.netPositionDesc')}</p>
            </div>
            <p className={cn('shrink-0 font-mono font-bold', summary.netPosition >= 0 ? 'text-[var(--accent)]' : 'text-amber-500')}>
              {formatBalance(summary.netPosition, hideAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Attention banner */}
      {summary.attentionCount > 0 && (
        <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 p-4" role="status"> {/* NOSONAR: S6819 */}
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-500/10 p-2 text-red-500" aria-hidden="true">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 className="font-bold text-red-500">{t('debt.attentionTitle')}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {summary.overdueCount > 0 && t('debt.overdueCount', { count: summary.overdueCount })}
                {summary.overdueCount > 0 && summary.dueSoonCount > 0 && ' • '}
                {summary.dueSoonCount > 0 && t('debt.dueSoonCount', { count: summary.dueSoonCount })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <search aria-label={t('Search debt')}>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)]" size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label={t('Search debt')}
            placeholder={t('Search debt')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--card)] py-3 pl-10 pr-12 placeholder:text-[var(--text-secondary)] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)]"
              aria-label={t('Clear search')}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </search>

      {/* Filters — Type */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('debt.filterType')}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('debt.filterType')}>
          {typeFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={typeFilter === item.id}
              onClick={() => setTypeFilter(item.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 min-h-[36px] text-xs font-bold transition-colors',
                typeFilter === item.id
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--bg)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters — Status */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('debt.filterStatus')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label={t('debt.filterStatus')}>
          {statusFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={statusFilter === item.id}
              onClick={() => setStatusFilter(statusFilter === item.id ? 'all' : item.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 min-h-[36px] text-xs font-bold transition-colors',
                statusFilter === item.id
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--bg)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      {filteredDebts.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="debt-sort" className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('debt.sortLabel')}</label>
          <select
            id="debt-sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as DebtSort)}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs font-bold min-h-[36px]"
          >
            <option value="due_soon">{t('debt.sortDueSoon')}</option>
            <option value="most_overdue">{t('debt.sortMostOverdue')}</option>
            <option value="highest">{t('debt.sortHighest')}</option>
            <option value="lowest">{t('debt.sortLowest')}</option>
            <option value="newest">{t('debt.sortNewest')}</option>
            <option value="name">{t('debt.sortName')}</option>
          </select>
        </div>
      )}

      {/* Results */}
      {(() => {
        if (isLoading) return (
          <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-36 w-full rounded-[16px]" />)}</div>
        );
        if (filteredDebts.length > 0) return (
          <div className="space-y-3" role="list" aria-label={t('Debts')}>
            {filteredDebts.map((debt) => (
              <DebtCard key={debt.id} debt={debt} payments={paymentsByDebt[debt.id] ?? []} wallet={walletMap[debt.walletId]} hideAmount={hideAmount}
                onClick={() => setSelectedDebt(debt)} onPayment={() => handlePayment(debt)} onEdit={() => handleEdit(debt)} />
            ))}
          </div>
        );
        if (!hasAnyDebt) return (
          <EmptyState icon={<Handshake size={36} />} title={t('debt.emptyFirstTitle')} description={t('debt.emptyFirstDesc')} action={{ label: t('debt.emptyFirstCta'), onClick: handleOpenForm }} />
        );
        if (hasFilters || searchTerm) return (
          <EmptyState icon={<Handshake size={36} />} title={t('debt.emptySearchTitle')} description="" action={{ label: t('debt.emptySearchClear'), onClick: () => { setSearchTerm(''); clearFilters(); } }} />
        );
        return (
          <EmptyState icon={<Handshake size={36} />} title={t('debt.emptyAllSettledTitle')} description={t('debt.emptyAllSettledDesc')} />
        );
      })()}

      <DebtFormSheet
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setDebtToEdit(null);
        }}
        hideAmount={hideAmount}
        debtToEdit={debtToEdit}
      />

      <DebtPaymentSheet
        isOpen={!!paymentDebt}
        debt={paymentDebt}
        onClose={() => setPaymentDebt(null)}
        hideAmount={hideAmount}
      />

      <DebtDetailSheet
        isOpen={!!activeSelectedDebt}
        debt={activeSelectedDebt}
        payments={activeSelectedDebt ? (paymentsByDebt[activeSelectedDebt.id] ?? []) : []}
        walletMap={walletMap}
        onClose={() => setSelectedDebt(null)}
        onPayment={handlePayment}
        onEdit={handleEdit}
        hideAmount={hideAmount}
      />
    </div>
  );
}
