import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn';
import { getTodayStr, getYesterdayStr } from '../utils/dateUtils';

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}

type QuickOption = {
  label: string;
  getValue: () => string;
};

export function DatePicker({ id, value, onChange, label, required }: DatePickerProps) {
  const { t } = useTranslation();
  const [showQuick, setShowQuick] = useState(false);

  const getDaysAgo = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0] ?? '';
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
    return d.toLocaleDateString('id-ID', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium mb-1">{label} {required && '*'}</label>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
          <input
            id={id}
            type="date"
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-[var(--accent)] appearance-none text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowQuick(!showQuick)}
          className={cn(
            "px-3 rounded-xl border transition-colors",
            showQuick 
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
          )}
          aria-label={t('Quick Select')}
        >
          <ChevronDown size={18} className={cn("transition-transform", showQuick && "rotate-180")} />
        </button>
      </div>

      {showQuick && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
          <div className="p-2">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider px-3 py-2">
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

      {/* Display formatted date below input */}
      {value && (
        <p className="text-xs text-[var(--text-secondary)] mt-1 ml-10">
          {formatDate(value)}
        </p>
      )}
    </div>
  );
}
