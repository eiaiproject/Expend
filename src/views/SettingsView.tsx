import { useState, useCallback, useEffect } from 'react';
import { ChevronDown, Lock, CloudCross, Information, Download, Trash2, Calendar, Cpu } from 'reicon-react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { Toast } from '../components/Toast';
import { csvBlob, xlsxBlob, filterByDate, exportFilename, downloadBlob } from '../utils/export';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getLLMConfig, saveLLMConfig, testLLMConnection, type LLMConfig } from '../utils/llm';

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
  const version: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
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

  const handleExportCSV = useCallback(async () => {
    try {
      const all = await db.transactions.toArray();
      const filtered = filterByDate(all, exportFrom || undefined, exportTo || undefined);
      if (!filtered.length) {
        showToast('Tidak ada transaksi untuk diekspor.', 'error');
        return;
      }
      const blob = csvBlob(filtered);
      downloadBlob(blob, exportFilename('csv', exportFrom || undefined, exportTo || undefined));
      showToast(`Berhasil mengekspor ${filtered.length} transaksi (CSV).`);
    } catch {
      showToast('Gagal mengekspor CSV.', 'error');
    }
  }, [exportFrom, exportTo, showToast]);

  const handleExportXLSX = useCallback(async () => {
    try {
      const all = await db.transactions.toArray();
      const filtered = filterByDate(all, exportFrom || undefined, exportTo || undefined);
      if (!filtered.length) {
        showToast('Tidak ada transaksi untuk diekspor.', 'error');
        return;
      }
      const blob = await xlsxBlob(filtered);
      downloadBlob(blob, exportFilename('xlsx', exportFrom || undefined, exportTo || undefined));
      showToast(`Berhasil mengekspor ${filtered.length} transaksi (Excel).`);
    } catch {
      showToast('Gagal mengekspor Excel.', 'error');
    }
  }, [exportFrom, exportTo, showToast]);

  const handleDeleteAll = useCallback(async () => {
    try {
      await db.transactions.clear();
      showToast('Semua data transaksi berhasil dihapus.');
    } catch {
      showToast('Gagal menghapus data. Coba lagi.', 'error');
    } finally {
      setConfirmDelete(false);
    }
  }, [showToast]);

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
      const msg = e instanceof Error ? e.message : 'Gagal terhubung.';
      setLlmTestResult({ ok: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setLlmTesting(false);
    }
  }, [showToast]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 pt-4 md:pt-0 pb-[calc(60px+env(safe-area-inset-bottom))] space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Atur tampilan, data, dan privasi"
      />

      {/* Preferences */}
      <SettingsSection title="Preferensi">
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Tema</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Pilih tampilan aplikasi</p>
              </div>
              <div className="relative">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  aria-label="Pilih tema"
                  className="h-10 pl-3 pr-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] appearance-none"
                >
                  <option value="system">Sistem</option>
                  <option value="light">Terang</option>
                  <option value="dark">Gelap</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" size={16} aria-hidden />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Format nominal</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Mata uang Rupiah</p>
              </div>
              <span className="text-sm font-medium text-[var(--text-muted)]">Rp</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Konfirmasi sebelum menyimpan</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Periksa detail sebelum disimpan</p>
              </div>
              <Toggle checked={confirmSave} onChange={setConfirmSave} label="Konfirmasi sebelum menyimpan" />
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      {/* Data */}
      <SettingsSection title="Data">
        <SectionCard padding="sm">
          <div className="px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-semibold">Ekspor rentang tanggal</p>
              <p className="text-xs text-[var(--text-secondary)]">Kosongkan untuk semua transaksi</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Dari</span>
                <div className="relative mt-1">
                  <input id="export-from" type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Sampai</span>
                <div className="relative mt-1">
                  <input id="export-to" type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" aria-hidden />
                </div>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-label="Ekspor CSV" onClick={handleExportCSV} disabled={txs.length === 0} aria-disabled={txs.length === 0} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                <Download size={16} aria-hidden /> Ekspor CSV
              </button>
              <button type="button" aria-label="Ekspor Excel" onClick={handleExportXLSX} disabled={txs.length === 0} aria-disabled={txs.length === 0} className="min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                <Download size={16} aria-hidden /> Ekspor Excel
              </button>
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      {/* LLM — Opsi A: BYOK tanpa backend */}
      <SettingsSection title="Kecerdasan Buatan">
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
                  <Cpu size={18} className="text-[var(--accent)]" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Parsing pintar (online)</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Gunakan LLM jika regex gagal. Butuh internet.</p>
                </div>
              </div>
              <Toggle checked={llmConfig.enabled} onChange={(v) => updateLLM({ enabled: v })} label="Parsing pintar" />
            </div>
            {llmConfig.enabled && (
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Data transaksi hanya dikirim ke LLM saat parsing. Kunci disimpan lokal di perangkat ini. Bisa pakai OpenRouter, OpenAI, atau 9router (OpenAI-compatible).</p>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Base URL</span>
                  <input value={llmConfig.baseUrl} onChange={(e) => updateLLM({ baseUrl: e.target.value })} placeholder="https://openrouter.ai/api/v1" autoComplete="off" spellCheck={false} className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                  <span className="text-[11px] text-[var(--text-muted)] mt-1 block">9router lokal: http://localhost:20128/v1 — OpenRouter: https://openrouter.ai/api/v1</span>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">API Key</span>
                  <input type="password" value={llmConfig.apiKey} onChange={(e) => updateLLM({ apiKey: e.target.value })} placeholder="sk-or-... atau sk-9r-..." autoComplete="off" spellCheck={false} className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Model</span>
                  <input value={llmConfig.model} onChange={(e) => updateLLM({ model: e.target.value })} placeholder="openai/gpt-4o-mini" autoComplete="off" spellCheck={false} className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:border-[var(--accent)]" />
                  <span className="text-[11px] text-[var(--text-muted)] mt-1 block">9router combo: free-tier — OpenRouter: openai/gpt-4o-mini, anthropic/claude-3.5-haiku</span>
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleTestLLM} disabled={llmTesting || !llmConfig.apiKey.trim() || !llmConfig.model.trim()} className="min-h-11 px-4 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40 disabled:active:scale-100">
                    {llmTesting ? 'Menguji...' : 'Uji koneksi'}
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
      <SettingsSection title="Privasi">
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <SettingsRow
              icon={<Lock size={18} />}
              title="Penyimpanan lokal"
              description="Data transaksi disimpan di perangkat ini. Menghapus data situs atau aplikasi dapat menghapus seluruh transaksi."
            />
            <SettingsRow
              icon={<CloudCross size={18} />}
              iconBg="bg-[var(--bg)] border border-[var(--border)]"
              iconColor="text-[var(--text-muted)]"
              title={llmConfig.enabled ? 'Koneksi LLM aktif' : 'Tanpa koneksi eksternal'}
              description={llmConfig.enabled ? 'Saat parsing pintar aktif, teks transaksi dikirim ke LLM (Base URL di atas). Matikan untuk 100% offline. OCR tetap lokal.' : 'Tidak ada data yang dikirim ke server. OCR diproses langsung di perangkat setelah model diunduh.'}
            />
            <SettingsRow
              icon={<Information size={18} />}
              iconBg="bg-[var(--bg)] border border-[var(--border)]"
              iconColor="text-[var(--text-muted)]"
              title="Tentang data bukti"
              description="Gambar bukti hanya diproses untuk OCR dan tidak disimpan secara permanen."
            />
          </div>
        </SectionCard>
      </SettingsSection>

      {/* About */}
      <SettingsSection title="Tentang aplikasi">
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
                <Information size={18} className="text-[var(--accent)]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Expend</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Pencatatan pengeluaran yang sederhana dan privat</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] px-2.5 py-1 text-xs font-mono font-bold">versi {version}</span>
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection title="Zona Berbahaya">
        <div className="rounded-[var(--radius-lg)] border border-[var(--danger-border)] bg-[var(--danger-bg)]/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--danger-soft)] grid place-items-center shrink-0">
              <Trash2 size={18} className="text-[var(--danger)]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--danger-deep)]">Hapus semua data</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{txs.length} transaksi akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <button
              type="button"
              aria-label="Hapus semua data transaksi"
              disabled={txs.length === 0}
              onClick={() => setConfirmDelete(true)}
              className="shrink-0 min-h-12 px-4 rounded-[var(--radius-md)] bg-[var(--danger)] text-white text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--danger)]/50 disabled:opacity-40 disabled:active:scale-100"
            >
              Hapus
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
        title="Hapus semua data?"
        description={`Seluruh ${txs.length} transaksi akan dihapus permanen dari perangkat ini. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus semua"
        cancelLabel="Batal"
        destructive
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
