import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Debt, DebtPayment } from '../db/db';
import { BottomSheetShell } from './BottomSheetShell';
import { format, parseISO } from 'date-fns';
import { cn } from '../utils/cn';
import { formatCurrencyIntl } from '../utils/formatUtils';
import { confirm } from './ConfirmDialog';
import { getPaymentsByDebt, deletePayment, settleDebt } from '../services/debtService';
import { ArrowUpRight, HandCoins, Clock, CheckCircle2, AlertTriangle, Trash2, Edit2, Plus, CreditCard } from 'lucide-react';

interface DebtDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
  onEdit: (debt: Debt) => void;
  onDelete: (debt: Debt) => void;
  onRecordPayment: (debt: Debt) => void;
}

export function DebtDetailSheet({ isOpen, onClose, debt, onEdit, onDelete, onRecordPayment }: DebtDetailSheetProps) {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<DebtPayment[]>([]);

  useEffect(() => {
    const loadPayments = async () => {
      if (debt?.id) {
        const p = await getPaymentsByDebt(debt.id);
        setPayments(p);
      }
    };
    if (isOpen) {
      loadPayments();
    }
  }, [debt?.id, isOpen]);

  const handleDeletePayment = async (paymentId: number) => {
    const confirmed = await confirm({
      title: t('Delete'),
      message: t('Are you sure you want to delete this payment?'),
      variant: 'danger',
    });
    if (confirmed) {
      await deletePayment(paymentId);
      // Reload payments
      if (debt?.id) {
        const p = await getPaymentsByDebt(debt.id);
        setPayments(p);
      }
    }
  };

  const handleSettle = async () => {
    if (!debt?.id) return;
    const confirmed = await confirm({
      title: t('Confirm'),
      message: t('Mark this debt as settled?'),
      variant: 'default',
    });
    if (confirmed) {
      await settleDebt(debt.id);
      onClose();
    }
  };

  if (!debt) return null;

  const isPayable = debt.type === 'payable';
  const paidPercentage = debt.amount > 0 ? ((debt.amount - debt.remainingAmount) / debt.amount) * 100 : 0;
  const isOverdue = debt.status === 'overdue';
  const isActive = debt.status !== 'settled';

  const statusConfig = {
    pending: { label: t('Pending'), color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    partial: { label: t('Partial'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    settled: { label: t('Settled'), color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    overdue: { label: t('Overdue'), color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };

  const statusInfo = statusConfig[debt.status];

  return (
    <BottomSheetShell isOpen={isOpen} onClose={onClose} title={debt.contactName}>
      <div className="px-3 py-4 space-y-4 overflow-y-auto">

        {/* Status Badge & Description */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-secondary)]">{debt.description}</p>
          <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-bold", statusInfo.color)}>
            {statusInfo.label}
          </span>
        </div>

        {/* Amount Info */}
        <div className="bg-[var(--bg)] rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">{t('Total Amount')}</p>
              <p className="font-mono font-bold text-lg">{formatCurrencyIntl(debt.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">{t('Remaining')}</p>
              <p className={cn(
                "font-mono font-bold text-lg",
                isPayable ? "text-orange-600" : "text-green-600"
              )}>
                {formatCurrencyIntl(debt.remainingAmount)}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--text-secondary)]">{t('Paid')}</span>
              <span className="font-medium">{paidPercentage.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isPayable ? "bg-orange-500" : "bg-green-500"
                )}
                style={{ width: `${paidPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Due Date */}
        {debt.dueDate && (
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-xl",
            isOverdue ? "bg-red-50 dark:bg-red-900/20" : "bg-[var(--bg)]"
          )}>
            {isOverdue ? (
              <AlertTriangle size={16} className="text-red-600" />
            ) : (
              <Clock size={16} className="text-[var(--text-secondary)]" />
            )}
            <span className={cn(
              "text-sm",
              isOverdue ? "text-red-600 font-medium" : "text-[var(--text-secondary)]"
            )}>
              {isOverdue ? t('Overdue since') : t('Due date')}: {format(parseISO(debt.dueDate), 'dd MMMM yyyy')}
            </span>
          </div>
        )}

        {/* Notes */}
        {debt.notes && (
          <div className="bg-[var(--bg)] p-3 rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1">{t('Notes')}</p>
            <p className="text-sm">{debt.notes}</p>
          </div>
        )}

        {/* Action Buttons */}
        {isActive && (
          <div className="flex gap-2">
            <button
              onClick={() => onRecordPayment(debt)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98]",
                isPayable
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-green-500 hover:bg-green-600"
              )}
            >
              <CreditCard size={18} />
              {t('Record Payment')}
            </button>
            <button
              onClick={handleSettle}
              className="px-4 py-3 rounded-xl font-bold bg-green-500 text-white hover:bg-green-600 transition-all active:scale-[0.98]"
            >
              <CheckCircle2 size={18} />
            </button>
          </div>
        )}

        {/* Edit & Delete Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(debt)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium bg-[var(--bg)] border border-[var(--border)] hover:bg-[var(--card)] transition-colors"
          >
            <Edit2 size={16} />
            {t('Edit')}
          </button>
          <button
            onClick={() => onDelete(debt)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
          >
            <Trash2 size={16} />
            {t('Delete')}
          </button>
        </div>

        {/* Payment History */}
        <div>
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <CreditCard size={16} />
            {t('Payment History')}
            <span className="text-xs font-normal text-[var(--text-secondary)]">({payments.length})</span>
          </h3>

          {payments.length === 0 ? (
            <div className="text-center py-6 text-[var(--text-secondary)]">
              <p className="text-sm">{t('No payments recorded yet')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-xl"
                >
                  <div className="flex-1">
                    <p className="font-mono font-medium text-green-600">
                      + {formatCurrencyIntl(payment.amount)}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {format(parseISO(payment.date), 'dd MMM yyyy')}
                      {payment.note && ` • ${payment.note}`}
                    </p>
                  </div>
                  <button
                    onClick={() => payment.id && handleDeletePayment(payment.id)}
                    className="p-2 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BottomSheetShell>
  );
}
