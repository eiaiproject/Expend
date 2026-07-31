import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, CalendarDays, Pause, Play, Plus, ReceiptText, Repeat, Trash2 } from 'reicon-react';
import { db, type Schedule } from '../db/db';
import { deleteSchedule, recordScheduleOccurrence, setScheduleActive } from '../services/recurringService';
import { getKnownErrorMessage } from '../services/errors';
import { usePrivacy } from '../contexts/PrivacyContext';
import { displayDateMedium, getTodayStr } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import { cn } from '../utils/cn';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ScheduleFormSheet } from '../components/ScheduleFormSheet';
import { confirm } from '../components/ConfirmDialog';
import { toast } from '../components/Toaster';

export default function SchedulesView() {
  const { t, i18n } = useTranslation();
  const { hideAmount } = usePrivacy();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<Schedule | null>(null);

  const schedules = useLiveQuery(() => db.schedules.toArray(), [], undefined);
  const categories = useLiveQuery(() => db.categories.toArray(), [], undefined);
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], undefined);

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categories ?? []) {
      if (cat.id != null) map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  const walletMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const wallet of wallets ?? []) {
      if (wallet.id != null) map.set(wallet.id, wallet.name);
    }
    return map;
  }, [wallets]);

  const isLoading = schedules === undefined || categories === undefined || wallets === undefined;
  const today = getTodayStr();

  const frequencyLabel = (frequency: Schedule['frequency']): string => {
    switch (frequency) {
      case 'weekly': return t('recurring.freqWeekly');
      case 'biweekly': return t('recurring.freqBiweekly');
      case 'monthly': return t('recurring.freqMonthly');
      case 'yearly': return t('recurring.freqYearly');
    }
  };

  const handleToggleActive = async (schedule: Schedule) => {
    try {
      await setScheduleActive(schedule.id, !schedule.active);
      toast.add(schedule.active ? t('recurring.toastPaused') : t('recurring.toastResumed'));
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, t('recurring.toastError')));
    }
  };

  const handleRecordNow = async (schedule: Schedule) => {
    try {
      // 'Record now' only appears for occurrences that are due (overdue or today),
      // so record on today's date and advance the schedule from there.
      await recordScheduleOccurrence(schedule.id, getTodayStr());
      toast.add(t('recurring.toastRecorded'));
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, t('recurring.toastError')));
    }
  };

  const handleDelete = async (schedule: Schedule) => {
    const confirmed = await confirm({
      title: t('recurring.deleteTitle'),
      message: t('recurring.deleteDesc', { name: schedule.payee ?? '' }),
      confirmLabel: t('Delete'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteSchedule(schedule.id);
      toast.add(t('recurring.toastDeleted'));
    } catch (error) {
      toast.add(getKnownErrorMessage(error, t, t('recurring.toastError')));
    }
  };

  const activeSchedules = (schedules ?? []).filter((s) => s.active);
  const pausedSchedules = (schedules ?? []).filter((s) => !s.active);

  const renderScheduleRow = (schedule: Schedule) => {
    const isDue = schedule.nextOccurrence <= today;
    return (
      <li key={schedule.id}>
        <article
          className={cn(
            'rounded-[16px] border bg-[var(--card)] p-4 shadow-sm transition-[border-color,box-shadow]',
            isDue && schedule.mode === 'remind' ? 'border-amber-500/30' : 'border-[var(--border)]',
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              schedule.mode === 'create' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-amber-500/10 text-amber-500',
            )}>
              {schedule.mode === 'create' ? <Play size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{schedule.payee}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {frequencyLabel(schedule.frequency)}
                    <span aria-hidden="true"> • </span>
                    {schedule.mode === 'create' ? t('recurring.modeCreate') : t('recurring.modeRemind')}
                    {schedule.categoryId != null && (
                      <>
                        <span aria-hidden="true"> • </span>
                        {categoryMap.get(schedule.categoryId) ?? t('recurring.unknownCategory')}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    schedule.active
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-[var(--border)]/40 text-[var(--text-secondary)]',
                  )}>
                    {schedule.active ? t('recurring.active') : t('recurring.paused')}
                  </span>
                </div>
              </div>

              {/* Next occurrence + wallet */}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                <span className={cn('inline-flex items-center gap-1', isDue && 'font-bold text-amber-600 dark:text-amber-300')}>
                  <CalendarDays size={12} aria-hidden="true" />
                  {isDue ? t('recurring.dueNow') : `${t('recurring.next')}: ${displayDateMedium(schedule.nextOccurrence, i18n.language)}`}
                </span>
                <span aria-hidden="true">•</span>
                <span>{walletMap.get(schedule.walletId) ?? t('Wallet not found')}</span>
              </div>
            </div>

            <p className="shrink-0 font-mono text-sm font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {hideAmount ? '•••••' : formatCurrency(schedule.amount)}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {schedule.mode === 'remind' && schedule.active && isDue && (
              <button
                type="button"
                onClick={() => handleRecordNow(schedule)}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-bold text-white shadow-sm active:scale-95 transition-transform"
              >
                <ReceiptText size={15} aria-hidden="true" />
                {t('recurring.recordNow')}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleToggleActive(schedule)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg)]"
            >
              {schedule.active ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
              {schedule.active ? t('recurring.pause') : t('recurring.resume')}
            </button>
            <button
              type="button"
              onClick={() => { setScheduleToEdit(schedule); setIsFormOpen(true); }}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg)]"
            >
              <Repeat size={15} aria-hidden="true" />
              {t('Edit')}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(schedule)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-bold text-red-500"
            >
              <Trash2 size={15} aria-hidden="true" />
              {t('Delete')}
            </button>
          </div>
        </article>
      </li>
    );
  };

  // Body content split by loading / empty / populated states (avoids a nested ternary).
  let pageContent: React.ReactNode;
  if (isLoading) {
    pageContent = (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-32 w-full rounded-[16px]" />)}
      </div>
    );
  } else if ((schedules ?? []).length === 0) {
    pageContent = (
      <EmptyState
        icon={<Repeat size={36} />}
        title={t('recurring.emptyTitle')}
        description={t('recurring.emptyDesc')}
        action={{ label: t('recurring.addCta'), onClick: () => { setScheduleToEdit(null); setIsFormOpen(true); } }}
      />
    );
  } else {
    pageContent = (
      <div className="space-y-6">
        {activeSchedules.length > 0 && (
          <section aria-label={t('recurring.sectionActive')}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] px-1">{t('recurring.sectionActive')}</h2>
            <ul className="space-y-3">{activeSchedules.map(renderScheduleRow)}</ul>
          </section>
        )}
        {pausedSchedules.length > 0 && (
          <section aria-label={t('recurring.sectionPaused')}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] px-1">{t('recurring.sectionPaused')}</h2>
            <ul className="space-y-3">{pausedSchedules.map(renderScheduleRow)}</ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('recurring.pageTitle')}</h1>
        <button
          type="button"
          onClick={() => { setScheduleToEdit(null); setIsFormOpen(true); }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20"
          aria-label={t('recurring.addLabel')}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Browser limitation note (master.md 7.2) */}
      <output
        className="flex items-start gap-2 rounded-[16px] border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-300"
      >
        <Pause size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{t('recurring.browserLimit')}</span>
      </output>

      {pageContent}

      <ScheduleFormSheet
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setScheduleToEdit(null); }}
        scheduleToEdit={scheduleToEdit}
      />
    </div>
  );
}
