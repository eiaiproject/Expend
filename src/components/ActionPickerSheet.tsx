import { useTranslation } from 'react-i18next';
import { ArrowDownCircle, Handshake, Repeat } from 'reicon-react';
import { BottomSheetShell } from './BottomSheetShell';

const LAST_ACTION_KEY = 'expend_last_action';

interface ActionPickerSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onAddExpense: () => void;
  readonly onTransfer: () => void;
  readonly onDebt: () => void;
}

export function ActionPickerSheet({
  isOpen,
  onClose,
  onAddExpense,
  onTransfer,
  onDebt,
}: ActionPickerSheetProps) {
  const { t } = useTranslation();

  const handleAction = (action: 'expense' | 'transfer' | 'debt', handler: () => void) => {
    try {
      localStorage.setItem(LAST_ACTION_KEY, action);
    } catch { /* ignore */ }
    handler();
  };

  const actions = [
    { key: 'expense' as const, onClick: () => handleAction('expense', onAddExpense), icon: <ArrowDownCircle size={20} />, iconBg: 'bg-red-500/10 text-red-500', title: t('Add Expense'), desc: t('Record a regular transaction'), label: t('Add Expense') },
    { key: 'transfer' as const, onClick: () => handleAction('transfer', onTransfer), icon: <Repeat size={20} />, iconBg: 'bg-[var(--accent)]/10 text-[var(--accent)]', title: t('Wallet Transfer'), desc: t('Move balance between wallets'), label: t('Transfer') },
    { key: 'debt' as const, onClick: () => handleAction('debt', onDebt), icon: <Handshake size={20} />, iconBg: 'bg-amber-500/10 text-amber-500', title: t('Record Debt'), desc: t('Track money lent or borrowed'), label: t('Record Debt') },
  ];

  // Sort: last used action first
  let lastAction: string | null = null;
  try {
    lastAction = localStorage.getItem(LAST_ACTION_KEY);
  } catch { /* ignore */ }

  const sorted = [
    actions[0]!, // Always pin Add Expense first
    ...actions.slice(1).sort((a, b) => {
      if (a.key === lastAction) return -1;
      if (b.key === lastAction) return 1;
      return 0;
    }),
  ];

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('Add Transaction')}
      ariaLabel={t('Choose action type')}
      heightClass="h-auto max-h-[80vh]"
    >
      <div className="px-3 py-4 space-y-3">
        {sorted.map(action => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="w-full rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4 text-left transition-colors hover:border-[var(--accent)]/60"
            aria-label={action.label}
          >
            <div className="flex items-start gap-3">
              <div className={`rounded-xl ${action.iconBg} p-2`}>                <span aria-hidden="true">{action.icon}</span>
              </div>
              <div>
                <h3 className="font-bold">{action.title}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{action.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </BottomSheetShell>
  );
}
