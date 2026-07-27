import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, CheckCircle, AlertTriangle, MoreH, Edit, Trash2, HandDollar } from 'reicon-react';
import { type Debt, type DebtPayment, type Wallet } from '../../db/db';
import { calculateDebtStatus, isDebtClosed, markDebtPaidWithoutCashflow, writeOffReceivable } from '../../services/debtService';
import { getKnownErrorMessage } from '../../services/errors';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/formatUtils';
import { daysBetweenDateOnly, displayDateShort, getTodayStr } from '../../utils/dateUtils';
import { confirm } from '../ConfirmDialog';
import { toast } from '../Toaster';

interface DebtCardProps {
  readonly debt: Debt;
  readonly payments: readonly DebtPayment[];
  readonly wallet?: Wallet;
  readonly hideAmount?: boolean;
  readonly onClick: () => void;
  readonly onPayment: () => void;
  readonly onEdit: () => void;
}

function getDueLabel(debt: Debt, t: (key: string, options?: Record<string, string | number>) => string, locale?: string): string {
  if (!debt.dueDate) return t('No due date label');

  const diff = daysBetweenDateOnly(debt.dueDate, getTodayStr());

  if (diff < 0) return t('Overdue days', { days: Math.abs(diff) });
  if (diff === 0) return t('Due today');
  if (diff === 1) return t('Due tomorrow');
  if (diff <= 7) return t('Due in days', { days: diff });
  return displayDateShort(debt.dueDate, locale);
}


// NOSONAR S3776 — cognitive complexity is inherent to this business logic
export function DebtCard({ debt, payments, wallet, hideAmount = false, onClick, onPayment, onEdit }: DebtCardProps) {
  const { t, i18n } = useTranslation();
  const status = calculateDebtStatus(debt, payments);
  const isPayable = debt.type === 'payable';
  const paidRatio = debt.principalAmount > 0
    ? Math.min(100, Math.max(0, ((debt.principalAmount - debt.remainingAmount) / debt.principalAmount) * 100))
    : 0;
  const closed = isDebtClosed(status);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen, closeMenu]);

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = menuItemsRef.current.filter(Boolean) as HTMLButtonElement[];
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items.at(-1)?.focus();
    }
  };

  const handleMarkPaid = async () => {
    closeMenu();
    const confirmed = await confirm({
      title: t('debt.toastSettled'),
      message: t('Mark paid desc', { type: isPayable ? t('Payable') : t('Receivable') }),
      confirmLabel: t('Status Paid'),
    });
    if (!confirmed) return;
    try {
      await markDebtPaidWithoutCashflow(debt.id);
      toast.add(t('debt.toastSettled'));
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, 'Action failed'));
    }
  };

  const handleWriteOff = async () => {
    closeMenu();
    const confirmed = await confirm({
      title: t('debt.writeOff'),
      message: t('Write off desc amount'),
      confirmLabel: t('Write Off'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await writeOffReceivable(debt.id);
      toast.add(t('debt.toastWrittenOff'));
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, 'Action failed'));
    }
  };

  const statusLabel = {
    open: t('debt.statusOpen'),
    partial: t('debt.statusPartialSettled'),
    paid: t('debt.statusPaidLabel'),
    overdue: t('debt.statusOverdueLabel'),
    written_off: t('debt.statusWrittenOffLabel'),
  }[status];

  return (
    <article
      data-testid="debt-row"
      data-debt-id={debt.id}
      data-debt-type={debt.type}
      className={cn(
        'w-full rounded-[16px] border bg-[var(--card)] p-4 shadow-sm transition-[border-color,box-shadow]',
        status === 'overdue' ? 'border-red-500/30' : 'border-[var(--border)]',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95',
            isPayable ? 'bg-amber-500/10 text-amber-500' : 'bg-[var(--accent)]/10 text-[var(--accent)]',
            status === 'overdue' && 'bg-red-500/10 text-red-500',
            closed && 'bg-green-500/10 text-green-500',
          )}
          aria-label={t('debt.viewDetail')}
        >
          <span className="sr-only">{t('debt.viewDetail')}</span>
          {(function renderDebtIcon() {
            if (status === 'overdue') return <AlertTriangle size={18} aria-hidden="true" />;
            if (closed) return <CheckCircle size={18} aria-hidden="true" />;
            if (isPayable) return <ArrowDownLeft size={18} aria-hidden="true" />;
            return <ArrowUpRight size={18} aria-hidden="true" />;
          })()}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <button type="button" onClick={onClick} className="truncate text-sm font-bold text-[var(--text-primary)] hover:underline">
                {debt.personName}
              </button>
              {debt.title && (
                <p className="truncate text-xs text-[var(--text-secondary)]">{debt.title}</p>
              )}
            </div>
            <div className="flex items-start gap-2">
              <div className="text-right">
                <p className={cn('font-mono text-sm font-bold', isPayable ? 'text-amber-500' : 'text-[var(--accent)]')}>
                  {formatCurrency(debt.remainingAmount, hideAmount)}
                </p>
                <span className={cn(
                  'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  isPayable ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'bg-[var(--accent)]/10 text-[var(--accent)]',
                )}>
                  {isPayable ? t('Payable') : t('Receivable')}
                </span>
              </div>
              {/* Overflow menu — sibling of clickable area, not nested */}
              {!closed && (
                <div className="relative" ref={menuRef}>
                  <button
                    ref={triggerRef}
                    type="button"
                    aria-label={t('debt.actionsFor', { name: debt.personName })}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg)]"
                  >
                    <MoreH size={18} />
                  </button>
                  {menuOpen && (
                    <div
                      tabIndex={-1}
                      role="menu"
                      aria-label={t('debt.actionsFor', { name: debt.personName })}
                      onKeyDown={handleMenuKeyDown}
                      className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg"
                    >
                      <button
                        type="button"
                        ref={(el) => { menuItemsRef.current[0] = el; }}
                        role="menuitem"
                        onClick={() => { closeMenu(); onClick(); }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[var(--bg)]"
                      >
                        <CheckCircle size={15} /> {t('debt.viewDetail')}
                      </button>
                      <button
                        type="button"
                        ref={(el) => { menuItemsRef.current[1] = el; }}
                        role="menuitem"
                        onClick={() => { closeMenu(); onPayment(); }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[var(--bg)]"
                      >
                        <HandDollar size={15} /> {t('debt.recordPayment')}
                      </button>
                      <button
                        type="button"
                        ref={(el) => { menuItemsRef.current[2] = el; }}
                        role="menuitem"
                        onClick={() => { closeMenu(); onEdit(); }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[var(--bg)]"
                      >
                        <Edit size={15} /> {t('debt.editRecord')}
                      </button>
                      <hr className="my-1 border-[var(--border)]" />
                      <button
                        type="button"
                        ref={(el) => { menuItemsRef.current[3] = el; }}
                        role="menuitem"
                        onClick={handleMarkPaid}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[var(--bg)]"
                      >
                        <CheckCircle size={15} /> {t('debt.markSettled')}
                      </button>
                      {debt.type === 'receivable' && (
                        <button
                          type="button"
                          ref={(el) => { menuItemsRef.current[4] = el; }}
                          role="menuitem"
                          onClick={handleWriteOff}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left text-amber-600 dark:text-amber-300 hover:bg-[var(--bg)]"
                        >
                          <Trash2 size={15} /> {t('debt.writeOff')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
            <span className={cn(status === 'overdue' && 'font-bold text-red-500')}>{statusLabel}</span>
            <span aria-hidden="true">•</span>
            <span className={status === 'overdue' ? 'text-red-500' : undefined}>{getDueLabel(debt, t, i18n.language)}</span>
            <span aria-hidden="true">•</span>
            <span>{wallet?.name ?? t('Wallet not found')}</span>
          </div>

          {/* Progress bar */}
          {!hideAmount && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-[var(--text-secondary)]">
                <span>{t('Part paid percent', { percent: paidRatio.toFixed(0) })}</span>
                <span className="sr-only">{t('debt.remaining', { amount: formatCurrency(debt.remainingAmount) })}</span>
              </div>
              <progress
                className="h-2 rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[var(--border)] [&::-webkit-progress-value]:rounded-full"
                value={paidRatio}
                max={100}
                aria-label={t('Part paid percent', { percent: paidRatio.toFixed(0) })}
                style={{ color: isPayable ? '#f59e0b' : 'var(--accent)' } as React.CSSProperties}
              />
            </div>
          )}

          {/* Quick payment button for closed cards */}
          {closed && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <CheckCircle size={14} className="text-green-500" />
              <span>{status === 'paid' ? t('debt.statusPaidLabel') : t('debt.statusWrittenOffLabel')}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
