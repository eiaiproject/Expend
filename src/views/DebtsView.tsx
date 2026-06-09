import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Debt } from '../db/db';
import { DebtCard } from '../components/DebtCard';
import { DebtFormSheet, DebtFormData } from '../components/DebtFormSheet';
import { DebtDetailSheet } from '../components/DebtDetailSheet';
import { DebtPaymentForm, PaymentFormData } from '../components/DebtPaymentForm';
import { Skeleton } from '../components/Skeleton';
import { toast } from '../components/Toaster';
import { cn } from '../utils/cn';
import {
  Plus,
  ArrowUpRight,
  HandCoins,
  Filter,
  Search,
  AlertTriangle,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import {
  createDebt,
  updateDebt,
  deleteDebt,
  addPayment,
  createPaymentTransaction,
  computeDebtSummary,
  checkOverdueDebts,
} from '../services/debtService';
import { confirm } from '../components/ConfirmDialog';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrencyIntl } from '../utils/formatUtils';

type FilterType = 'all' | 'payable' | 'receivable';
type FilterStatus = 'all' | 'pending' | 'partial' | 'overdue' | 'settled';

function DebtsView() {
  const { t } = useTranslation();

  // State
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);

  // Check for overdue debts on mount (write operation — must be outside useLiveQuery)
  useEffect(() => {
    checkOverdueDebts();
  }, []);

  // Database queries (read-only)
  const debts = useLiveQuery(() => db.debts.toArray(), [], undefined);

  const wallets = useLiveQuery(() => db.wallets.toArray(), [], []);

  // Loading state
  const isLoading = debts === undefined;

  // Summary
  const [summary, setSummary] = useState({
    totalPayable: 0,
    totalReceivable: 0,
    activePayable: 0,
    activeReceivable: 0,
    overdueCount: 0,
  });

  // Compute summary when debts change
  useEffect(() => {
    if (debts) {
      computeDebtSummary().then(setSummary);
    }
  }, [debts]);

  // Filter debts
  const filteredDebts = useMemo(() => {
    if (!debts) return [];

    return debts.filter((debt) => {
      // Type filter
      if (filterType !== 'all' && debt.type !== filterType) return false;

      // Status filter
      if (filterStatus !== 'all' && debt.status !== filterStatus) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          debt.contactName.toLowerCase().includes(search) ||
          debt.description.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [debts, filterType, filterStatus, searchTerm]);

  // Handlers
  const handleCreateDebt = useCallback(async (data: DebtFormData) => {
    // Generate translated description for the initial transaction
    const description = data.type === 'payable'
      ? t('Loan received: {{name}}', { name: data.contactName })
      : t('Loan given: {{name}}', { name: data.contactName });
    const loanDescription = t('Loan: {{description}}', { description: data.description });
    await createDebt(data, description);
    toast.add(t('Debt added successfully'));
  }, [t]);

  const handleUpdateDebt = useCallback(async (data: DebtFormData) => {
    if (editDebt?.id) {
      await updateDebt(editDebt.id, data);
      toast.add(t('Debt updated successfully'));
      setEditDebt(null);
    }
  }, [editDebt, t]);

  const handleDeleteDebt = useCallback(async (debt: Debt) => {
    if (!debt.id) return;
    const confirmed = await confirm({
      title: t('Delete'),
      message: t('Are you sure you want to delete this debt?'),
      variant: 'danger',
    });
    if (confirmed) {
      // Generate translated description to find the initial transaction
      const description = debt.type === 'payable'
        ? t('Loan received: {{name}}', { name: debt.contactName })
        : t('Loan given: {{name}}', { name: debt.contactName });
      await deleteDebt(debt.id, description);
      toast.add(t('Debt deleted successfully'));
      setIsDetailOpen(false);
      setSelectedDebt(null);
    }
  }, [t]);

  const handleRecordPayment = useCallback(async (data: PaymentFormData) => {
    if (!selectedDebt?.id) return;

    await addPayment(selectedDebt.id, {
      amount: data.amount,
      date: data.date,
      note: data.note,
    });

    // Create transaction if enabled and wallet is linked
    if (data.createTransaction && selectedDebt.walletId) {
      try {
        // Generate translated descriptions for the transaction
        const description = selectedDebt.type === 'payable'
          ? t('Debt payment: {{name}}', { name: selectedDebt.contactName })
          : t('Receivable payment: {{name}}', { name: selectedDebt.contactName });
        const paymentNote = t('Payment for: {{description}}', { description: selectedDebt.description });
        await createPaymentTransaction(selectedDebt, data.amount, data.date, data.note, description, paymentNote);
      } catch (error) {
        console.error('Failed to create transaction:', error);
      }
    }

    toast.add(t('Payment recorded successfully'));
    setIsPaymentOpen(false);

    // Refresh selected debt
    const updatedDebt = await db.debts.get(selectedDebt.id);
    if (updatedDebt) {
      setSelectedDebt(updatedDebt);
    }
  }, [selectedDebt, t]);

  const handleEdit = useCallback((debt: Debt) => {
    setEditDebt(debt);
    setIsDetailOpen(false);
    setIsFormOpen(true);
  }, []);

  const handleRecordPaymentClick = useCallback((debt: Debt) => {
    setSelectedDebt(debt);
    setIsDetailOpen(false);
    setIsPaymentOpen(true);
  }, []);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black tracking-tighter uppercase">{t('Debts')}</h1>
        <button
          onClick={() => {
            setEditDebt(null);
            setIsFormOpen(true);
          }}
          aria-label={t('Add Debt')}
          className="p-2 bg-[var(--accent)] text-white rounded-xl shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-500 rounded-[16px] p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={18} className="text-white/80" />
            <span className="text-xs font-bold text-white/80 uppercase">{t('Payable')}</span>
          </div>
          <p className="font-mono font-bold text-lg">{formatCurrencyIntl(summary.activePayable)}</p>
          <p className="text-[11px] text-white/60 mt-1">
            {t('Total')}: {formatCurrencyIntl(summary.totalPayable)}
          </p>
        </div>
        <div className="bg-green-500 rounded-[16px] p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <HandCoins size={18} className="text-white/80" />
            <span className="text-xs font-bold text-white/80 uppercase">{t('Receivable')}</span>
          </div>
          <p className="font-mono font-bold text-lg">{formatCurrencyIntl(summary.activeReceivable)}</p>
          <p className="text-[11px] text-white/60 mt-1">
            {t('Total')}: {formatCurrencyIntl(summary.totalReceivable)}
          </p>
        </div>
      </div>

      {/* Overdue Alert */}
      {summary.overdueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3"
        >
          <AlertTriangle size={20} className="text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {summary.overdueCount} {t('overdue debts')}
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">
              {t('Please check and follow up')}
            </p>
          </div>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
        <input
          type="text"
          placeholder={t('Search debts...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {(['all', 'payable', 'receivable'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all",
              filterType === type
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)]"
            )}
          >
            {type === 'all' ? t('All') : type === 'payable' ? t('Payable') : t('Receivable')}
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {(['all', 'pending', 'partial', 'overdue', 'settled'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
              filterStatus === status
                ? status === 'overdue'
                  ? "bg-red-500 text-white border-red-500"
                  : status === 'settled'
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)]"
            )}
          >
            {status === 'all' ? t('All') : t(status.charAt(0).toUpperCase() + status.slice(1))}
          </button>
        ))}
      </div>

      {/* Debt List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-32 rounded-[16px]" />
          ))
        ) : filteredDebts.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-[var(--card)] w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border)]">
              <Wallet size={48} className="text-[var(--text-secondary)] opacity-30" />
            </div>
            <h3 className="font-bold text-[var(--text-primary)]">{t('No Debts')}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {t('Start by adding a new debt')}
            </p>
            <button
              onClick={() => {
                setEditDebt(null);
                setIsFormOpen(true);
              }}
              aria-label={t('Add Debt')}
              className="mt-4 px-6 py-3 bg-[var(--accent)] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
            >
              {t('Add Debt')}
            </button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredDebts.map((debt) => (
              <motion.div
                key={debt.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <DebtCard
                  debt={debt}
                  onClick={() => {
                    setSelectedDebt(debt);
                    setIsDetailOpen(true);
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Sheets */}
      <DebtFormSheet
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditDebt(null);
        }}
        onSave={editDebt ? handleUpdateDebt : handleCreateDebt}
        debtToEdit={editDebt}
      />

      <DebtDetailSheet
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedDebt(null);
        }}
        debt={selectedDebt}
        onEdit={handleEdit}
        onDelete={handleDeleteDebt}
        onRecordPayment={handleRecordPaymentClick}
      />

      <DebtPaymentForm
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          setSelectedDebt(null);
        }}
        onSave={handleRecordPayment}
        debt={selectedDebt}
      />
    </div>
  );
}

export default DebtsView;
