import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, Lock, CloudCross, Information, Download, Trash2, Calendar, Cpu } from 'reicon-react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { Toast } from '../components/Toast';
import { csvBlob, xlsxBlob, jsonBlob, parseImportJSON, IMPORT_MAX_BYTES, filterByDate, exportFilename, downloadBlob, validateDateRange } from '../utils/export';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getLLMConfig, saveLLMConfig, testLLMConnection, type LLMConfig } from '../utils/llm';
import { useTranslation } from '../i18n';
import type { Lang } from '../i18n';
import { buildInfo } from '../utils/buildInfo';

type Theme = 'system' | 'light' | 'dark';
type ToastState = { message: string; type: 'success' | 'error' } | null;

function SettingsSection({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section aria-labelledby={`section-${title.toLowerCase().replace(/\s/g, '-')}`} className="space-y-2">
      <h2 id={`section-${title.toLowerCase().replace(/\s/g, '-')}`} className="text-xs font-bold tracking-wide uppercase text-[var(--text-secondary)] px-1">{title}</h2>
      {children}
    </section>
  );
}

function SettingsRow({
  icon,
  iconBg = 'bg-[var(--accent-soft)]',
  iconColor = 'text-[var(--accent)]',
  title,
  description,
  action,
  trailing,
}: {
  readonly icon: React.ReactNode;
  readonly iconBg?: string;
  readonly iconColor?: string;
  readonly title: string;
  readonly description?: string;
  readonly action?: () => void;
  readonly trailing?: React.ReactNode;
}) {
  const Tag = action ? 'button' : 'div';
  return (
    <Tag
      type={action ? 'button' : undefined}
      onClick={action}
      className={`flex items-center gap-3 px-4 py-3 w-full text-left ${action ? 'hover:bg-[var(--bg)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded-[var(--radius-md)]' : ''}`}
    >
      <div className={`w-9 h-9 rounded-[var(--radius-md)] ${iconBg} grid place-items-center shrink-0`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {trailing ?? (action && <ChevronDown size={16} className="text-[var(--text-muted)] shrink-0 pointer-events-none" aria-hidden />)}
    </Tag>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
  readonly label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative flex items-center min-h-12 min-w-12 justify-center focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded-[var(--radius-md)]"
    >
      <div
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-[var(--accent-fill)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[var(--accent-ink)] shadow-sm transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
          aria-hidden
        />
      </div>
    </button>
  );
}

export default function SettingsView() {
  const { t, lang, setLang } = useTranslation();
  const { version, commit, date: buildDate } = buildInfo();
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
  const [toast, setToast] = useState<ToastState>(null);
  const [confirmSave, setConfirmSave] = useState(() => {
    const v = localStorage.getItem('confirmSave');
    return v === null ? true : v === 'true';
  });
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(() => getLLMConfig());
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Persist confirmSave
  useEffect(() => {
    localStorage.setItem('confirmSave', String(confirmSave));
  }, [confirmSave]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      delete root.dataset.theme;
      localStorage.removeItem('theme');
    } else {
      root.dataset.theme = theme;
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  // Satu jalur ekspor untuk csv/xlsx/json: validasi range + filter + empty
  // check hanya sekali agar tidak terduplikasi per format.
  const handleExport = useCallback(async (kind: 'csv' | 'xlsx' | 'json') => {
    const rangeErr = validateDateRange(exportFrom || undefined, exportTo || undefined);
    if (rangeErr === 'from-after-to') {
      showToast(t('settings.fromAfterTo'), 'error');
      return;
    }
    if (rangeErr === 'invalid-date') {
      showToast(t('settings.invalidDate'), 'error');
      return;
    }
    try {
      const all = await db.transactions.toArray();
      const filtered = filterByDate(all, exportFrom || undefined, exportTo || undefined);
      if (!filtered.length) {
        showToast(t('settings.noExport'), 'error');
        return;
      }
      if (kind === 'csv') {
        downloadBlob(csvBlob(filtered), exportFilename('csv', exportFrom || undefined, exportTo || undefined));
        showToast(t('settings.exportCSVSukses', { count: filtered.length }));
      } else if (kind === 'xlsx') {
        downloadBlob(await xlsxBlob(filtered), exportFilename('xlsx', exportFrom || undefined, exportTo || undefined));
        showToast(t('settings.exportXLSXSukses', { count: filtered.length }));
      } else {
        downloadBlob(jsonBlob(filtered), exportFilename('json', exportFrom || undefined, exportTo || undefined));
        showToast(t('settings.exportJSONSukses', { count: filtered.length }));
      }
    } catch {
      showToast(t(kind === 'csv' ? 'settings.exportCSVError' : kind === 'xlsx' ? 'settings.exportXLSXError' : 'settings.exportJSONError'), 'error');
    }
  }, [exportFrom, exportTo, showToast, t]);

  const handleImportFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
      showToast(t('settings.importJSONError'), 'error');
      return;
    }
    if (file.size > IMPORT_MAX_BYTES || file.size === 0) {
      showToast(t('settings.importJSONError'), 'error');
      return;
    }
    try {
      const raw = await file.text();
      const res = parseImportJSON(raw);
      if (!res.ok || res.transactions.length === 0) {
        showToast(res.errors[0] ?? t('settings.importJSONError'), 'error');
        return;
      }
      // Append-only: jangan hapus data lama. Dedupe eksak terhadap DB.
      const existing = await db.transactions.toArray();
      const existingKeys = new Set(existing.map((tx) => `${tx.description}|${tx.amount}|${tx.date}|${tx.source ?? ''}|${tx.note ?? ''}`));
      const fresh = res.transactions.filter((tx) => !existingKeys.has(`${tx.description}|${tx.amount}|${tx.date}|${tx.source ?? ''}|${tx.note ?? ''}`));
      if (fresh.length) await db.transactions.bulkAdd(fresh.map((tx) => ({ ...tx })));
      const skippedTotal = res.skipped + (res.transactions.length - fresh.length);
      showToast(skippedTotal > 0 ? `${t('settings.importJSONSukses', { count: fresh.length })} ${t('settings.importJSONSkipped', { count: skippedTotal })}` : t('settings.importJSONSukses', { count: fresh.length }));
    } catch {
      showToast(t('settings.importJSONError'), 'error');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }, [showToast, t]);

  const handleDeleteAll = useCallback(async () => {
    try {
      await db.transactions.clear();
      showToast(t('settings.deleteSuccess'));
    } catch {
      showToast(t('settings.deleteError'), 'error');
    } finally {
      setConfirmDelete(false);
    }
  }, [showToast, t]);

  const updateLLM = useCallback((patch: Partial<LLMConfig>) => {
    setLlmConfig((prev) => {
      const next = { ...prev, ...patch };
      saveLLMConfig(next);
      return next;
    });
    setLlmTestResult(null);
  }, []);

  const handleTestLLM = useCallback(async () => {
    setLlmTesting(true);
    setLlmTestResult(null);
    try {
      const result = await testLLMConnection();
      setLlmTestResult(result);
      showToast(result.message, result.ok ? 'success' : 'error');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('settings.deleteError');
      setLlmTestResult({ ok: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setLlmTesting(false);
    }
  }, [showToast, t]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 pt-4 md:pt-0 pb-[calc(60px+env(safe-area-inset-bottom))] space-y-6">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.subtitle')}
      />

      {/* Preferences */}
      <SettingsSection title={t('settings.preferences')}>
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.theme')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.themeDesc')}</p>
              </div>
              <div className="relative">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  aria-label={t('settings.theme')}
                  className="h-10 pl-3 pr-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] appearance-none"
                >
                  <option value="system">{t('settings.themeSystem')}</option>
                  <option value="light">{t('settings.themeLight')}</option>
                  <option value="dark">{t('settings.themeDark')}</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" size={16} aria-hidden />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.numberFormat')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.numberFormatDesc')}</p>
              </div>
              <span className="text-sm font-medium text-[var(--text-muted)]">Rp</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.confirmSave')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.confirmSaveDesc')}</p>
              </div>
              <Toggle checked={confirmSave} onChange={setConfirmSave} label={t('settings.confirmSave')} />
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      {/* Data */}
      {/* Language */}
      <SettingsSection title={t('settings.language')}>
        <SectionCard padding="sm">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.language')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.languageDesc')}</p>
              </div>
              <div className="relative">
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                  aria-label={t('settings.language')}
                  className="h-10 pl-3 pr-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] appearance-none"
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" size={16} aria-hidden />
              </div>
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      <SettingsSection title={t('settings.data')}>
        <SectionCard padding="sm">
          <div className="px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-semibold">{t('settings.exportDateRange')}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t('settings.exportDateRangeDesc')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.from')}</span>
                <div className="relative mt-1">
                  <input id="export-from" type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.to')}</span>
                <div className="relative mt-1">
                  <input id="export-to" type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden />
                </div>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-label={t('settings.exportCSV')} onClick={() => void handleExport('csv')} disabled={txs.length === 0} aria-disabled={txs.length === 0} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                <Download size={16} aria-hidden /> {t('settings.exportCSV')}
              </button>
              <button type="button" aria-label={t('settings.exportExcel')} onClick={() => void handleExport('xlsx')} disabled={txs.length === 0} aria-disabled={txs.length === 0} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                <Download size={16} aria-hidden /> {t('settings.exportExcel')}
              </button>
              <button type="button" aria-label={t('settings.exportJSON')} onClick={() => void handleExport('json')} disabled={txs.length === 0} aria-disabled={txs.length === 0} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                <Download size={16} aria-hidden /> {t('settings.exportJSON')}
              </button>
              <button type="button" aria-label={t('settings.importJSON')} onClick={() => importRef.current?.click()} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                <Download size={16} aria-hidden /> {t('settings.importJSON')}
              </button>
            </div>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" aria-label={t('settings.importJSON')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />
          </div>
        </SectionCard>
      </SettingsSection>

      {/* LLM — Opsi A: BYOK tanpa backend */}
      <SettingsSection title={t('settings.ai')}>
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
                  <Cpu size={18} className="text-[var(--accent)]" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t('settings.smartParsing')}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.smartParsingDesc')}</p>
                </div>
              </div>
              <Toggle checked={llmConfig.enabled} onChange={(v) => updateLLM({ enabled: v })} label={t('settings.smartParsing')} />
            </div>
            {llmConfig.enabled && (
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('settings.llmPrivacy')}</p>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.baseUrl')}</span>
                  <input value={llmConfig.baseUrl} onChange={(e) => updateLLM({ baseUrl: e.target.value })} placeholder="https://openrouter.ai/api/v1" autoComplete="off" spellCheck={false} className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                  <span className="text-[11px] text-[var(--text-muted)] mt-1 block">{t('settings.baseUrlHint')}</span>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.apiKey')}</span>
                  <input type="password" value={llmConfig.apiKey} onChange={(e) => updateLLM({ apiKey: e.target.value })} placeholder="sk-or-... atau sk-9r-..." autoComplete="off" spellCheck={false} className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.model')}</span>
                  <input value={llmConfig.model} onChange={(e) => updateLLM({ model: e.target.value })} placeholder="openai/gpt-4o-mini" autoComplete="off" spellCheck={false} className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                  <span className="text-[11px] text-[var(--text-muted)] mt-1 block">{t('settings.modelHint')}</span>
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleTestLLM} disabled={llmTesting || !llmConfig.apiKey.trim() || !llmConfig.model.trim()} className="min-h-11 px-4 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                    {llmTesting ? t('settings.testing') : t('settings.testConnection')}
                  </button>
                  {llmTestResult && (
                    <span className={`text-xs font-medium ${llmTestResult.ok ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{llmTestResult.message}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </SettingsSection>

      {/* Privacy */}
      <SettingsSection title={t('settings.privacy')}>
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <SettingsRow
              icon={<Lock size={18} />}
              title={t('settings.localStorage')}
              description={t('settings.localStorageDesc')}
            />
            <SettingsRow
              icon={<CloudCross size={18} />}
              iconBg="bg-[var(--bg)] border border-[var(--border)]"
              iconColor="text-[var(--text-muted)]"
              title={llmConfig.enabled ? t('settings.externalConnectionActive') : t('settings.noExternalConnection')}
              description={llmConfig.enabled ? t('settings.llmActiveDesc') : t('settings.offlineDesc')}
            />
            <SettingsRow
              icon={<Information size={18} />}
              iconBg="bg-[var(--bg)] border border-[var(--border)]"
              iconColor="text-[var(--text-muted)]"
              title={t('settings.receiptData')}
              description={t('settings.receiptDataDesc')}
            />
          </div>
        </SectionCard>
      </SettingsSection>

      {/* About */}
      <SettingsSection title={t('settings.about')}>
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
                <Information size={18} className="text-[var(--accent)]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Expend</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.aboutDesc')}</p>
              </div>
              <span title={buildDate ? `build ${buildDate}` : undefined} className="inline-flex items-center rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] px-2.5 py-1 text-xs font-mono font-bold">{t('settings.version', { version })} · {commit}</span>
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection title={t('settings.dangerZone')}>
        <div className="rounded-[var(--radius-lg)] border border-[var(--danger-border)] bg-[var(--danger-bg)]/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--danger-soft)] grid place-items-center shrink-0">
              <Trash2 size={18} className="text-[var(--danger)]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--danger-deep)]">{t('settings.deleteAll')}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.deleteAllDesc', { count: txs.length })}</p>
            </div>
            <button
              type="button"
              aria-label={t('settings.deleteAll')}
              disabled={txs.length === 0}
              onClick={() => setConfirmDelete(true)}
              className="shrink-0 min-h-12 px-4 rounded-[var(--radius-md)] bg-[var(--danger)] text-white text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--danger)]/50 disabled:opacity-40 disabled:active:scale-100"
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* Footer */}
      <div className="text-center pt-2 pb-4">
        <p className="text-[11px] text-[var(--text-muted)] font-mono">expend.pages.dev</p>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Confirm Delete All */}
      <ConfirmDialog
        open={confirmDelete}
        title={t('settings.deleteAllConfirm')}
        description={t('settings.deleteAllConfirmDesc', { count: txs.length })}
        confirmLabel={t('settings.deleteAllButton')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
