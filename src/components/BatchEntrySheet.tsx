import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from './BottomSheetShell';
import { ClipboardAdd } from 'reicon-react';
import { parseBatchLines } from '../services/naturalTextParser';
import { saveTransaction } from '../services/transactionSaveService';
import { getDefaultExpenseWallet } from '../services/walletPreferenceService';
import { getTodayStr } from '../utils/dateUtils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toast } from './Toaster';

interface BatchEntrySheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Paste multiline "payee amount" lines → preview → save all (automation B3). */
export function BatchEntrySheet({ isOpen, onClose }: BatchEntrySheetProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const wallets = useLiveQuery(() => db.wallets.toArray(), [], undefined) ?? [];

  const entries = useMemo(() => (text.trim() ? parseBatchLines(text) : []), [text]);

  const handleSave = async () => {
    if (entries.length === 0) return;
    const defaultWallet = await getDefaultExpenseWallet(wallets);
    if (!defaultWallet?.id) {
      toast.add(t('Select a wallet first'));
      return;
    }
    setIsSaving(true);
    let saved = 0;
    try {
      for (const entry of entries) {
        try {
          await saveTransaction({
            amount: parseFloat(entry.amount.replace(/\./g, '').replace(',', '.')),
            description: entry.description || 'Unknown',
            date: getTodayStr(),
            walletId: defaultWallet.id,
            categoryId: null,
            notes: '',
            type: 'expense',
          });
          saved += 1;
        } catch {
          // Insufficient balance etc. — skip that entry, keep the rest.
        }
      }
      if (saved > 0) {
        toast.add(t('batch.savedToast', { count: saved }));
        setText('');
        onClose();
      } else {
        toast.add(t('batch.noneSaved'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomSheetShell isOpen={isOpen} onClose={onClose} title={t('batch.title')} size="full">
      <div className="px-4 py-4 space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('batch.placeholder')}
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 font-mono text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 min-h-[160px]"
          aria-label={t('batch.title')}
        />
        {entries.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              {t('batch.preview')} ({entries.length})
            </p>
            <ul className="space-y-1.5">
              {entries.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-3 bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm">
                  <span className="truncate text-[var(--text-primary)]">{e.description || 'Unknown'}</span>
                  <span className="font-mono font-semibold text-[var(--text-secondary)] shrink-0">
                    Rp {parseFloat(e.amount.replace(/\./g, '').replace(',', '.')).toLocaleString('id-ID')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={entries.length === 0 || isSaving}
          className="w-full flex items-center justify-center gap-2 bg-[var(--accent-fill)] text-[var(--accent-ink)] font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 min-h-[52px]"
        >
          <ClipboardAdd size={18} aria-hidden="true" />
          {t('batch.save', { count: entries.length })}
        </button>
      </div>
    </BottomSheetShell>
  );
}