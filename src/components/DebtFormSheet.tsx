import { useState, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Debt, Wallet, Category } from '../db/db';
import { BottomSheetShell } from './BottomSheetShell';
import { format } from 'date-fns';
import { cn } from '../utils/cn';
import { ArrowUpRight, HandCoins } from 'lucide-react';

interface DebtFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DebtFormData) => void;
  debtToEdit?: Debt | null;
}

export interface DebtFormData {
  type: 'payable' | 'receivable';
  contactName: string;
  description: string;
  amount: number;
  dueDate?: string;
  walletId?: number;
  categoryId?: number;
  notes?: string;
}

export function DebtFormSheet({ isOpen, onClose, onSave, debtToEdit }: DebtFormSheetProps) {
  const { t } = useTranslation();
  const formId = useId();
  const contactNameInputId = `${formId}-contact-name`;
  const descriptionInputId = `${formId}-description`;
  const amountInputId = `${formId}-amount`;
  const dueDateInputId = `${formId}-due-date`;
  const walletInputId = `${formId}-wallet`;
  const categoryInputId = `${formId}-category`;
  const notesInputId = `${formId}-notes`;

  const wallets = useLiveQuery(() => db.wallets.toArray(), [], []);
  const categories = useLiveQuery(() => db.categories.toArray(), [], []);

  const [type, setType] = useState<'payable' | 'receivable'>('payable');
  const [contactName, setContactName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [walletId, setWalletId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (debtToEdit) {
      setType(debtToEdit.type);
      setContactName(debtToEdit.contactName);
      setDescription(debtToEdit.description);
      setAmount(debtToEdit.amount.toString());
      setDueDate(debtToEdit.dueDate || '');
      setWalletId(debtToEdit.walletId || '');
      setCategoryId(debtToEdit.categoryId || '');
      setNotes(debtToEdit.notes || '');
    } else {
      resetForm();
    }
  }, [debtToEdit, isOpen]);

  const resetForm = () => {
    setType('payable');
    setContactName('');
    setDescription('');
    setAmount('');
    setDueDate('');
    setWalletId('');
    setCategoryId('');
    setNotes('');
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!contactName.trim()) {
      newErrors.contactName = t('Contact name is required');
    }
    if (!description.trim()) {
      newErrors.description = t('Description is required');
    }
    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = t('Amount must be greater than 0');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    onSave({
      type,
      contactName: contactName.trim(),
      description: description.trim(),
      amount: parseFloat(amount),
      dueDate: dueDate || undefined,
      walletId: walletId || undefined,
      categoryId: categoryId || undefined,
      notes: notes.trim() || undefined,
    });

    resetForm();
    onClose();
  };

  return (
    <BottomSheetShell isOpen={isOpen} onClose={onClose} title={debtToEdit ? t('Edit Debt') : t('Add Debt')}>
      <div className="px-3 py-4 space-y-4">

        {/* Type Toggle */}
        <div className="flex gap-2 bg-[var(--bg)] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setType('payable')}
            aria-pressed={type === 'payable'}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all",
              type === 'payable'
                ? "bg-orange-500 text-white shadow"
                : "text-[var(--text-secondary)] hover:bg-[var(--card)]"
            )}
          >
            <ArrowUpRight size={16} />
            {t('Payable')}
          </button>
          <button
            type="button"
            onClick={() => setType('receivable')}
            aria-pressed={type === 'receivable'}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all",
              type === 'receivable'
                ? "bg-green-500 text-white shadow"
                : "text-[var(--text-secondary)] hover:bg-[var(--card)]"
            )}
          >
            <HandCoins size={16} />
            {t('Receivable')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact Name */}
          <div>
            <label htmlFor={contactNameInputId} className="block text-sm font-medium mb-1.5">{t('Contact Name')}</label>
            <input
              id={contactNameInputId}
              type="text"
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
                if (errors.contactName) setErrors(prev => ({ ...prev, contactName: '' }));
              }}
              placeholder={t('e.g. Budi, Toko ABC')}
              className={cn(
                "w-full px-4 py-3 bg-[var(--bg)] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]",
                errors.contactName ? "border-red-500" : "border-[var(--border)]"
              )}
              required
            />
            {errors.contactName && (
              <p className="text-red-500 text-xs mt-1">{errors.contactName}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor={descriptionInputId} className="block text-sm font-medium mb-1.5">{t('Description')}</label>
            <input
              id={descriptionInputId}
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
              }}
              placeholder={t('e.g. Pinjaman untuk beli laptop')}
              className={cn(
                "w-full px-4 py-3 bg-[var(--bg)] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]",
                errors.description ? "border-red-500" : "border-[var(--border)]"
              )}
              required
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor={amountInputId} className="block text-sm font-medium mb-1.5">{t('Amount')}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">Rp</span>
              <input
                id={amountInputId}
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
                }}
                placeholder="0"
                min="1"
                className={cn(
                  "w-full pl-10 pr-4 py-3 bg-[var(--bg)] border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] font-mono",
                  errors.amount ? "border-red-500" : "border-[var(--border)]"
                )}
                required
              />
            </div>
            {errors.amount && (
              <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor={dueDateInputId} className="block text-sm font-medium mb-1.5">{t('Due Date')} ({t('Optional')})</label>
            <input
              id={dueDateInputId}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={debtToEdit?.dueDate || format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
            />
          </div>

          {/* Wallet (Optional) */}
          <div>
            <label htmlFor={walletInputId} className="block text-sm font-medium mb-1.5">
              {t('Link to Wallet')} ({t('Optional')})
            </label>
            <select
              id={walletInputId}
              value={walletId}
              onChange={(e) => setWalletId(e.target.value ? Number(e.target.value) : '')}
              className="w-full pl-4 pr-12 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
            >
              <option value="">{t('No Wallet')}</option>
              {wallets?.map((wallet: Wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category (Optional) */}
          <div>
            <label htmlFor={categoryInputId} className="block text-sm font-medium mb-1.5">
              {t('Category')} ({t('Optional')})
            </label>
            <select
              id={categoryInputId}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
              className="w-full pl-4 pr-12 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
            >
              <option value="">{t('No Category')}</option>
              {categories?.map((cat: Category) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor={notesInputId} className="block text-sm font-medium mb-1.5">{t('Notes')} ({t('Optional')})</label>
            <textarea
              id={notesInputId}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('Additional notes...')}
              rows={2}
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={cn(
              "w-full py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98]",
              type === 'payable'
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-green-500 hover:bg-green-600"
            )}
          >
            {debtToEdit ? t('Update') : t('Save')}
          </button>
        </form>
      </div>
    </BottomSheetShell>
  );
}
