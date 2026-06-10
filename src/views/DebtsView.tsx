import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Eye, EyeOff, Handshake, Plus, Search, X } from 'lucide-react';
import { db, type Debt, type DebtPayment, type Wallet } from '../db/db';
import { DebtCard } from '../components/debts/DebtCard';
import { DebtDetailSheet } from '../components/debts/DebtDetailSheet';
import { DebtFormSheet } from '../components/debts/DebtFormSheet';
import { DebtPaymentSheet } from '../components/debts/DebtPaymentSheet';
import { Skeleton } from '../components/Skeleton';
import { buildDebtPaymentsMap, calculateDebtStatus, summarizeDebts } from '../services/debtService';
import { getTodayStr } from '../utils/dateUtils';
import { formatCurrency, formatBalance } from '../utils/formatUtils';
import { cn } from '../utils/cn';

type DebtFilter = 'all' | 'payable' | 'receivable' | 'active' | 'overdue' | 'paid';

function buildWalletMap(wallets: readonly Wallet[]): Record<number, Wallet | undefined> {
  return wallets.reduce<Record<number, Wallet | undefined>>((acc, wallet) => {
    if (wallet.id != null) acc[wallet.id] = wallet;
    return acc;
  }, {});
}

function matchesFilter(
  debt: Debt,
  paymentsByDebt: Record<string, readonly DebtPayment[]>,
  filter: DebtFilter,
): boolean {
  const status = calculateDebtStatus(debt, paymentsByDebt[debt.id] ?? []);
  if (filter === 'all') return true;
  if (filter === 'payable' || filter === 'receivable') return debt.type === filter;
  if (filter === 'active') return status === 'open' || status === 'partial';
  if (filter === 'overdue') return status === 'overdue';
  return status === 'paid' || status === 'written_off';
}

function sortDebts(
  debts: readonly Debt[],
  paymentsByDebt: Record<string, readonly DebtPayment[]>,
): Debt[] {
  const today = getTodayStr();
  return [...debts].sort((a, b) => {
    const statusA = calculateDebtStatus(a, paymentsByDebt[a.id] ?? [], today);
    const statusB = calculateDebtStatus(b, paymentsByDebt[b.id] ?? [], today);
    const overdueA = statusA === 'overdue' ? 0 : 1;
    const overdueB = statusB === 'overdue' ? 0 : 1;
    if (overdueA !== overdueB) return overdueA - overdueB;

    const dueA = a.dueDate ?? '9999-12-31';
    const dueB = b.dueDate ?? '9999-12-31';
    if (dueA !== dueB) return dueA.localeCompare(dueB);

    if (b.remainingAmount !== a.remainingAmount) return b.remainingAmount - a.remainingAmount;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function searchDebt(debt: Debt, searchTerm: string, includeAmounts: boolean): boolean {
  if (!searchTerm.trim()) return true;
  const query = searchTerm.trim().toLowerCase();
  const values = [
    debt.personName,
    debt.title ?? '',
    debt.notes ?? '',
  ];
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
  const [hideAmount, setHideAmount] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<DebtFilter>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [debtToEdit, setDebtToEdit] = useState<Debt | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);

  const FILTERS: Array<{ id: DebtFilter; labelKey: string }> = [
    { id: 'all', labelKey: 'All Debts' },
    { id: 'payable', labelKey: 'Payable' },
    { id: 'receivable', labelKey: 'Receivable' },
    { id: 'active', labelKey: 'Active' },
    { id: 'overdue', labelKey: 'Overdue' },
    { id: 'paid', labelKey: 'Paid' },
  ];

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
  const safeDebts = debts ?? [];
  const safePayments = payments ?? [];
  const safeWallets = wallets ?? [];
  const paymentsByDebt = useMemo(() => buildDebtPaymentsMap(safePayments), [safePayments]);
  const walletMap = useMemo(() => buildWalletMap(safeWallets), [safeWallets]);
  const summary = useMemo(() => summarizeDebts(safeDebts, paymentsByDebt), [safeDebts, paymentsByDebt]);
  const activeSelectedDebt = useMemo(
    () => selectedDebt ? (safeDebts.find((debt) => debt.id === selectedDebt.id) ?? selectedDebt) : null,
    [safeDebts, selectedDebt],
  );

  const filteredDebts = useMemo(() => {
    const visibleDebts = safeDebts.filter((debt) => !debt.archivedAt);
    return sortDebts(
      visibleDebts.filter((debt) => matchesFilter(debt, paymentsByDebt, filter) && searchDebt(debt, searchTerm, !hideAmount)),
      paymentsByDebt,
    );
  }, [filter, hideAmount, paymentsByDebt, safeDebts, searchTerm]);

  const hasAnyDebt = safeDebts.some((debt) => !debt.archivedAt);

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

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('Utang Piutang')}</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{t('Debt Info Local')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHideAmount((value) => !value)}
            className="rounded-full border border-[var(--border)] bg-[var(--card)] p-2"
            aria-label={hideAmount ? t('Show Amount') : t('Hide Amount')}
          >
            {hideAmount ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <button
            type="button"
            onClick={handleOpenForm}
            className="rounded-full bg-[var(--accent)] p-2 text-white shadow-lg shadow-[var(--accent)]/20"
            aria-label={t('Record Debt')}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{t('Debt Summary')}</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{t('Not Including Wallet Balance')}</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold">{t('My Payable')}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t('Payable Desc')}</p>
            </div>
            <p className="shrink-0 font-mono font-bold text-amber-500">{formatCurrency(summary.payableTotal, hideAmount)}</p>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold">{t('My Receivable')}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t('Receivable Desc')}</p>
            </div>
            <p className="shrink-0 font-mono font-bold text-[var(--accent)]">{formatCurrency(summary.receivableTotal, hideAmount)}</p>
          </div>
          <div className="border-t border-[var(--border)] pt-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold">{t('Net Position')}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t('Receivable Minus Payable')}</p>
            </div>
            <p className={cn('shrink-0 font-mono font-bold', summary.netPosition >= 0 ? 'text-[var(--accent)]' : 'text-amber-500')}>
              {formatBalance(summary.netPosition, hideAmount)}
            </p>
          </div>
        </div>
      </div>

      {summary.attentionCount > 0 && (
        <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-500/10 p-2 text-red-500">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 className="font-bold text-red-500">{t('Needs Attention')}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {t('overdue count', { count: summary.overdueCount })}
                {summary.dueSoonCount > 0 ? ` • ${t('due soon count', { count: summary.dueSoonCount })}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)]" size={18} />
        <input
          type="text"
          aria-label={t('Search debt')}
          placeholder={t('Search debt')}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-3 pl-10 pr-12 placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-secondary)]"
            aria-label={t('Clear search')}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95',
              filter === item.id
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--bg)]',
            )}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-36 w-full rounded-[16px]" />
          ))}
        </div>
      ) : filteredDebts.length > 0 ? (
        <div className="space-y-3">
          {filteredDebts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              payments={paymentsByDebt[debt.id] ?? []}
              wallet={walletMap[debt.walletId]}
              hideAmount={hideAmount}
              onClick={() => setSelectedDebt(debt)}
              onPayment={() => handlePayment(debt)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-[16px] border border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)]">
            <Handshake size={36} />
          </div>
          <h2 className="font-bold">{hasAnyDebt ? t('No matching debts') : t('No debts yet')}</h2>
          <p className="mt-2 max-w-[260px] text-sm text-[var(--text-secondary)]">
            {hasAnyDebt
              ? t('Try changing filter')
              : t('Record debt desc')}
          </p>
          {!hasAnyDebt && (
            <button
              type="button"
              onClick={handleOpenForm}
              className="mt-5 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20"
            >
              {t('Record Debt')}
            </button>
          )}
        </div>
      )}

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
