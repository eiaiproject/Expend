import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Lock, CloudCross, Information, Download, Upload, Trash2 } from 'reicon-react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';

type Theme = 'system' | 'light' | 'dark';
type ToastState = { message: string; type: 'success' | 'error' } | null;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

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
      className={`flex items-center gap-3 px-4 py-3 w-full text-left ${action ? 'hover:bg-[var(--bg)] active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded-[var(--radius-md)]' : ''}`}
    >
      <div className={`w-9 h-9 rounded-[var(--radius-md)] ${iconBg} grid place-items-center shrink-0`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {trailing ?? (action && <ChevronRight size={18} className="text-[var(--text-muted)] shrink-0" aria-hidden />)}
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirmSave, setConfirmSave] = useState(() => {
    const v = localStorage.getItem('confirmSave');
    return v === null ? true : v === 'true';
  });
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load storage info
  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((est) => {
        setStorageInfo({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
      }).catch(() => {});
    }
  }, []);

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

  const handleExport = useCallback(async () => {
    try {
      const transactions = await db.transactions.toArray();
      const chatMessages = await db.chatMessages.toArray();
      const data = { version: '1.0', exportedAt: new Date().toISOString(), transactions, chatMessages };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `expend-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Berhasil mengekspor ${transactions.length} transaksi.`);
    } catch {
      showToast('Gagal mengekspor data. Coba lagi.', 'error');
    }
  }, [showToast]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.transactions || !Array.isArray(data.transactions)) {
        showToast('Format file tidak valid. Gunakan file JSON dari Expend.', 'error');
        return;
      }
      const validTxs = data.transactions.filter(
        (t: any) => typeof t.description === 'string' && typeof t.amount === 'number' && typeof t.date === 'string'
      );
      if (validTxs.length === 0) {
        showToast('Tidak ada transaksi valid ditemukan dalam file.', 'error');
        return;
      }
      await db.transactions.bulkAdd(validTxs.map((t: any) => ({
        description: t.description,
        amount: t.amount,
        date: t.date,
        createdAt: t.createdAt || new Date().toISOString(),
        rawText: t.rawText,
      })));
      showToast(`Berhasil mengimpor ${validTxs.length} transaksi.`);
    } catch {
      showToast('Gagal membaca file. Pastikan format file benar.', 'error');
    }
  }, [showToast]);

  const handleDeleteAll = useCallback(async () => {
    try {
      await db.transactions.clear();
      await db.chatMessages.clear();
      setConfirmDelete(false);
      showToast('Semua data berhasil dihapus.');
    } catch {
      showToast('Gagal menghapus data. Coba lagi.', 'error');
    }
  }, [showToast]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 pt-4 md:pt-0 pb-8 space-y-6">
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
                <p className="text-sm font-semibold">Mata uang</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Format nominal</p>
              </div>
              <span className="text-sm font-medium text-[var(--text-muted)]">IDR</span>
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
          <div className="divide-y divide-[var(--border)]">
            <SettingsRow
              icon={<Download size={18} />}
              title="Ekspor data"
              description={`${txs.length} transaksi &middot; format JSON`}
              action={handleExport}
            />
            <SettingsRow
              icon={<Upload size={18} />}
              iconBg="bg-[var(--bg)] border border-[var(--border)]"
              iconColor="text-[var(--text-secondary)]"
              title="Impor data"
              description="Dari file JSON Expend"
              action={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = '';
              }}
            />
            <SettingsRow
              icon={<Trash2 size={18} />}
              iconBg="bg-[var(--danger-bg)]"
              iconColor="text-[var(--danger)]"
              title="Hapus semua data"
              description="Tindakan ini tidak dapat dibatalkan"
              action={() => setConfirmDelete(true)}
            />
            {storageInfo && (
              <div className="px-4 py-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Penggunaan penyimpanan: {formatBytes(storageInfo.usage)} dari {formatBytes(storageInfo.quota)}
                </p>
                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${Math.min((storageInfo.usage / storageInfo.quota) * 100, 100)}%` }}
                  />
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
              title="Tanpa koneksi eksternal"
              description="Tidak ada data yang dikirim ke server. OCR diproses langsung di perangkat setelah model diunduh."
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
              <span className="inline-flex items-center rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] px-2.5 py-1 text-xs font-mono font-bold">v{version}</span>
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      {/* Footer */}
      <div className="text-center pt-2 pb-4">
        <p className="text-[11px] text-[var(--text-muted)] font-mono">expend.pages.dev</p>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={confirmDelete}
        title="Hapus semua data?"
        description="Semua transaksi dan riwayat chat akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus semua"
        cancelLabel="Batal"
        destructive
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
