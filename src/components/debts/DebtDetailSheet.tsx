import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { type Debt, type DebtPayment, type Wallet } from '../../db/db';
import { archiveDebt, calculateDebtStatus, isDebtClosed, markDebtPaidWithoutCashflow, writeOffReceivable } from '../../services/debtService';
import { cn } from '../../utils/cn';
import { parseDate } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatUtils';
import { BottomSheetShell } from '../BottomSheetShell';
import { confirm } from '../ConfirmDialog';
import { toast } from '../Toaster';

interface DebtDetailSheetProps {
  debt: Debt | null;
  payments: readonly DebtPayment[];
  walletMap: Record<number, Wallet | undefined>;
  isOpen: boolean;
  onClose: () => void;
  onPayment: (debt: Debt) => void;
  onEdit: (debt: Debt) => void;
  hideAmount?: boolean;
}

function paymentCopy(debt: Debt, payment: DebtPayment): { label: string; sign: '+' | '-' | ''; className: string } {
  if (payment.type === 'initial') {
    return debt.type === 'payable'
      ? { label: 'Uang pinjaman diterima', sign: '+', className: 'text-[var(--accent)]' }
      : { label: 'Pinjaman diberikan', sign: '-', className: 'text-amber-500' };
  }

  if (payment.type === 'repayment') {
    return debt.type === 'payable'
      ? { label: 'Pembayaran utang', sign: '-', className: 'text-amber-500' }
      : { label: 'Pembayaran diterima', sign: '+', className: 'text-[var(--accent)]' };
  }

  if (payment.type === 'write_off') {
    return { label: 'Piutang diikhlaskan', sign: '', className: 'text-[var(--text-secondary)]' };
  }

  return { label: 'Ditandai lunas', sign: '', className: 'text-[var(--text-secondary)]' };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Aksi gagal diproses.';
}

export function DebtDetailSheet({
  debt,
  payments,
  walletMap,
  isOpen,
  onClose,
  onPayment,
  onEdit,
  hideAmount = false,
}: DebtDetailSheetProps) {
  if (!debt) return null;

  const isPayable = debt.type === 'payable';
  const status = calculateDebtStatus(debt, payments);
  const closed = isDebtClosed(status);
  const paidRatio = debt.principalAmount > 0
    ? Math.min(100, Math.max(0, ((debt.principalAmount - debt.remainingAmount) / debt.principalAmount) * 100))
    : 0;
  const sortedPayments = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const title = isPayable ? 'Detail Utang' : 'Detail Piutang';

  const handleMarkPaid = async () => {
    const confirmed = await confirm({
      title: 'Tandai sebagai lunas?',
      message: hideAmount
        ? `Sisa ${isPayable ? 'utang' : 'piutang'} akan ditutup tanpa mengubah saldo wallet.`
        : `Sisa ${isPayable ? 'utang' : 'piutang'} akan menjadi Rp0 tanpa mengubah saldo wallet.`,
      confirmLabel: 'Tandai Lunas',
    });
    if (!confirmed) return;

    try {
      await markDebtPaidWithoutCashflow(debt.id);
      toast.add(isPayable ? 'Utang ditandai lunas.' : 'Piutang ditandai lunas.');
    } catch (error) {
      toast.add(getErrorMessage(error));
    }
  };

  const handleWriteOff = async () => {
    const confirmed = await confirm({
      title: 'Ikhlaskan piutang?',
      message: hideAmount
        ? 'Sisa piutang akan ditutup tanpa menambah saldo wallet.'
        : 'Sisa piutang akan menjadi Rp0 tanpa menambah saldo wallet.',
      confirmLabel: 'Ikhlaskan',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await writeOffReceivable(debt.id);
      toast.add('Piutang diikhlaskan.');
    } catch (error) {
      toast.add(getErrorMessage(error));
    }
  };

  const handleArchive = async () => {
    const confirmed = await confirm({
      title: 'Hapus catatan?',
      message: 'Catatan akan diarsipkan. Saldo wallet tidak diubah karena transaksi kas sudah pernah terjadi.',
      confirmLabel: 'Hapus',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await archiveDebt(debt.id);
      toast.add(isPayable ? 'Utang dihapus.' : 'Piutang dihapus.');
      onClose();
    } catch (error) {
      toast.add(getErrorMessage(error));
    }
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      ariaLabel={title}
      heightClass="h-[90vh]"
    >
      <div className="px-3 py-4 space-y-5">
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold">{debt.personName}</p>
              <p className="text-sm text-[var(--text-secondary)]">{isPayable ? 'Utang' : 'Piutang'}</p>
              {debt.title && <p className="mt-2 text-sm">{debt.title}</p>}
            </div>
            <span className={cn(
              'rounded-full px-2.5 py-1 text-xs font-bold',
              status === 'overdue' ? 'bg-red-500/10 text-red-500' : 'bg-[var(--accent)]/10 text-[var(--accent)]',
            )}>
              {{
                open: 'Aktif',
                partial: 'Sebagian dibayar',
                paid: 'Lunas',
                overdue: 'Lewat jatuh tempo',
                written_off: 'Diikhlaskan',
              }[status]}
            </span>
          </div>

          <div className="mt-5">
            <p className="font-mono text-2xl font-bold">{formatCurrency(debt.remainingAmount, hideAmount)}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Sisa dari {formatCurrency(debt.principalAmount, hideAmount)}
            </p>
          </div>

          {!hideAmount && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-[var(--text-secondary)]">
                <span>{paidRatio.toFixed(0)}% lunas</span>
                <span>{walletMap[debt.walletId]?.name ?? 'Wallet tidak ditemukan'}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--border)]">
                <div
                  className={cn('h-full rounded-full', isPayable ? 'bg-amber-500' : 'bg-[var(--accent)]')}
                  style={{ width: `${paidRatio}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Tanggal pinjam</p>
              <p className="mt-1">{format(parseDate(debt.startDate), 'dd MMM yyyy', { locale: localeId })}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Jatuh tempo</p>
              <p className="mt-1">{debt.dueDate ? format(parseDate(debt.dueDate), 'dd MMM yyyy', { locale: localeId }) : 'Tanpa jatuh tempo'}</p>
            </div>
          </div>

          {debt.notes && (
            <p className="mt-4 rounded-xl bg-[var(--card)] p-3 text-sm text-[var(--text-secondary)]">{debt.notes}</p>
          )}
        </div>

        {!closed && (
          <button
            type="button"
            onClick={() => onPayment(debt)}
            className="w-full rounded-xl bg-[var(--accent)] py-3.5 font-bold text-white shadow-lg shadow-[var(--accent)]/20 active:scale-95"
          >
            {isPayable ? 'Bayar Utang' : 'Terima Pembayaran'}
          </button>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onEdit(debt)}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm font-bold text-[var(--text-secondary)]"
          >
            <Pencil size={15} /> Edit
          </button>
          <button
            type="button"
            disabled={closed}
            onClick={handleMarkPaid}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm font-bold text-[var(--text-secondary)] disabled:opacity-40"
          >
            <CheckCircle2 size={15} /> Lunas
          </button>
          <button
            type="button"
            onClick={handleArchive}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm font-bold text-red-500"
          >
            <Trash2 size={15} /> Hapus
          </button>
        </div>

        {!isPayable && !closed && (
          <button
            type="button"
            onClick={handleWriteOff}
            className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-sm font-bold text-amber-600 dark:text-amber-300"
          >
            Ikhlaskan Piutang
          </button>
        )}

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">Riwayat</h3>
          <div className="space-y-3">
            {sortedPayments.map((payment) => {
              const copy = paymentCopy(debt, payment);
              return (
                <div key={payment.id} className="flex items-start gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className={cn('mt-0.5 rounded-full p-2', isPayable ? 'bg-amber-500/10 text-amber-500' : 'bg-[var(--accent)]/10 text-[var(--accent)]')}>
                    {copy.sign === '-' ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">{format(parseDate(payment.date), 'dd MMM', { locale: localeId })} • {copy.label}</p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {walletMap[payment.walletId]?.name ?? 'Wallet tidak ditemukan'}
                        </p>
                      </div>
                      <p className={cn('shrink-0 font-mono text-sm font-bold', copy.className)}>
                        {copy.sign}{formatCurrency(payment.amount, hideAmount)}
                      </p>
                    </div>
                    {payment.notes && (
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">{payment.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BottomSheetShell>
  );
}
