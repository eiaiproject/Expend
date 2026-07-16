import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { CURATED_PALETTE } from '../../utils/constants';
import type { Category } from '../../db/db';

interface CategoryFormProps {
  mode: 'add' | 'edit';
  initialCategory?: Category;
  onSubmit: (data: { name: string; color: string; budget?: number }) => void;
  onCancel: () => void;
  existingNames?: string[];
}

export function CategoryForm({ mode, initialCategory, onSubmit, onCancel, existingNames = [] }: CategoryFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialCategory?.name ?? '');
  const [color, setColor] = useState(initialCategory?.color ?? CURATED_PALETTE[0]);
  const [budget, setBudget] = useState(initialCategory?.budget?.toString() ?? '');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('Category Name') + ' ' + t('is required'));
      return;
    }
    if (existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase() && n !== initialCategory?.name)) {
      setError(t('A category with this name already exists'));
      return;
    }
    const budgetVal = budget ? parseInt(budget.replace(/[^0-9]/g, ''), 10) : undefined;
    onSubmit({ name: trimmed, color, budget: budgetVal });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`cat-name-${mode}`} className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
          {t('Category Name')}
        </label>
        <input
          ref={nameRef}
          id={`cat-name-${mode}`}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
          maxLength={50}
          aria-describedby={error ? `cat-name-error-${mode}` : undefined}
          aria-invalid={!!error}
        />
        {error && (
          <p id={`cat-name-error-${mode}`} className="text-xs text-red-500 mt-1" role="alert">{error}</p>
        )}
      </div>

      <div>
        <span className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">{t('categories.colorLabel')}</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('categories.colorLabel')}>
          {CURATED_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'w-8 h-8 rounded-full transition-all border-2 border-[var(--border)] min-w-[32px] min-h-[32px]',
                color === c ? 'ring-2 ring-offset-2 ring-offset-[var(--card)] ring-[var(--accent)] scale-110 border-transparent' : 'hover:scale-110'
              )}
              style={{ backgroundColor: c }}
              role="radio"
              aria-checked={color === c}
              aria-label={t('Select color {{color}}', { color: c })}
            />
          ))}
        </div>
      </div>

      <div>
        <label htmlFor={`cat-budget-${mode}`} className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
          {t('Monthly Budget')}
        </label>
        <input
          id={`cat-budget-${mode}`}
          type="text"
          inputMode="numeric"
          value={budget}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            setBudget(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
          }}
          placeholder="0"
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm font-mono focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
        />
        <p className="text-xs text-[var(--text-secondary)] mt-1">{t('categories.budgetHelperText')}</p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 items-center justify-center gap-2 px-4 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={16} aria-hidden="true" />
          {t('Cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="flex h-11 items-center justify-center gap-2 px-5 text-sm bg-[var(--accent)] text-white rounded-xl font-medium hover:opacity-90 transition-colors"
        >
          <Save size={16} aria-hidden="true" />
          {t('Save')}
        </button>
      </div>
    </div>
  );
}
