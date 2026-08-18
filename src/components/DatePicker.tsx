import { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronDown } from 'reicon-react';
import { cn } from '../utils/cn';
import { getTodayStr, getYesterdayStr } from '../utils/dateUtils';

interface DatePickerProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
  readonly required?: boolean;
}

type QuickOption = {
  label: string;
  getValue: () => string;
};

export function DatePicker({ id, value, onChange, label, required }: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const [showQuick, setShowQuick] = useState(false);
  const autoId = useId();
  const datePickerId = id || autoId;
  const menuId = `${datePickerId}-quick-menu`;

  const getDaysAgo = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return getTodayStr(d);
  };

  const quickOptions: QuickOption[] = [
    { label: t('Today'), getValue: () => getTodayStr() ?? '' },
    { label: t('Yesterday'), getValue: () => getYesterdayStr() ?? '' },
    { label: t('2 days ago'), getValue: () => getDaysAgo(2) },
    { label: t('3 days ago'), getValue: () => getDaysAgo(3) },
    { label: t('1 week ago'), getValue: () => getDaysAgo(7) },
  ];

  const handleQuickSelect = (option: QuickOption) => {
    onChange(option.getValue());
    setShowQuick(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(i18n.language?.startsWith('id') ? 'id-ID' : 'en-US', {
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="relative">
      {label && (
        <label htmlFor={datePickerId} className="block text-sm font-medium mb-1.5">{label} {required && '*'}</label>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} aria-hidden="true" />
          <input
            id={datePickerId}
            type="date"
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow] appearance-none text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowQuick(!showQuick)}
          className={cn(
            "px-3 rounded-xl border transition-colors",
            showQuick 
              ? "bg-[var(--accent-fill)] text-[var(--accent-ink)] border-[var(--accent-fill)]"
              : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
          )}
          aria-label={t('Quick Select')}
          aria-expanded={showQuick}
          aria-controls={menuId}
          aria-haspopup="listbox"
        >
          <ChevronDown size={18} className={cn("transition-transform", showQuick && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      {showQuick && (
        <div 
          id={menuId}
          className="absolute z-30 left-0 right-0 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden"
        >
          <div className="p-2">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider px-3 py-2" id={`${menuId}-label`}>
              {t('Quick Select')}
            </p>
            {quickOptions.map((option) => {
              const optionValue = option.getValue();
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleQuickSelect(option)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors",
                    value === optionValue 
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "hover:bg-[var(--bg)]"
                  )}
                >
                  {option.label}
                  <span className="text-xs text-[var(--text-secondary)] ml-2">
                    {formatDate(optionValue)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
