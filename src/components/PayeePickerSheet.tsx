import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ShoppingBag, X } from 'reicon-react';
import { BottomSheetShell } from './BottomSheetShell';
import { getPayeeStatsCached, type PayeeStats } from '../services/payeeService';

interface PayeePickerSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** Called with the chosen payee name; the caller fills the form and closes the picker. */
  readonly onSelect: (payeeName: string) => void;
}

/**
 * Payee picker rendered ABOVE the transaction form (z-index 70 > form's 50).
 *
 * Design-audit fix: the previous "Choose payee" link navigated to /payees
 * behind the still-open form sheet, forcing the user to close the form to
 * pick a payee. This picker pops up in front instead — selecting a payee
 * fills the form's description and keeps the form open.
 */
export function PayeePickerSheet({ isOpen, onClose, onSelect }: PayeePickerSheetProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [payees, setPayees] = useState<PayeeStats[]>([]);

  // Reload the list and clear the search each time the picker opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setQuery('');
    // Cached variant — repeated opens don't re-scan every expense (B2).
    void getPayeeStatsCached()
      .then((list) => { if (!cancelled) setPayees(list); })
      .catch(() => { if (!cancelled) setPayees([]); });
    return () => { cancelled = true; };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payees;
    return payees.filter((p) => p.name.toLowerCase().includes(q));
  }, [payees, query]);

  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('form.choosePayee')}
      ariaLabel={t('form.choosePayee')}
      zIndex={70}
      size="medium"
    >
      <div className="px-4 py-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} aria-hidden="true" />
          <input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('payees.searchPlaceholder')}
            aria-label={t('payees.searchLabel')}
            className="w-full h-11 pl-9 pr-9 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--card)]"
              aria-label={t('payees.clearSearch')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Payee list */}
        {payees.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t('payees.emptyTitle')}</p>
            <p className="text-xs text-[var(--text-secondary)]">{t('payees.emptyDesc')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">{t('payees.searchEmpty')}</p>
          </div>
        ) : (
          <ul className="space-y-1 max-h-[40vh] overflow-y-auto overscroll-contain">
            {filtered.map((payee) => (
              <li key={payee.key}>
                <button
                  type="button"
                  onClick={() => onSelect(payee.name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-[var(--bg)] min-h-[44px]"
                >
                  <span className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                    <ShoppingBag size={15} className="text-[var(--accent)]" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">{payee.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BottomSheetShell>
  );
}
