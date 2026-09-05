import type * as XLSXTypes from 'xlsx';
import type { Transaction } from '../db/db';
import { t } from '../i18n/standalone';

const XLSXLoader = () => import('xlsx');

async function getXLSX(): Promise<typeof XLSXTypes> {
  return (await XLSXLoader()).default ?? (await XLSXLoader() as unknown as typeof XLSXTypes);
}

export type ExportRow = { [key: string]: string | number };

export function toExportRows(txs: Transaction[]): ExportRow[] {
  return txs.map((tx) => ({
    [t('export.date')]: sanitizeExportString(tx.date),
    [t('export.description')]: sanitizeExportString(tx.description),
    [t('export.amount')]: tx.amount,
    [t('export.source')]: sanitizeExportString(tx.source ?? ''),
    [t('export.note')]: sanitizeExportString(tx.note ?? ''),
    [t('export.createdAt')]: sanitizeExportString(tx.createdAt),
  }));
}

/**
 * Mitigasi CSV/XLSX formula injection (OWASP).
 * Value string yang diawali = + - @ diprefix single-quote agar Excel/Sheets
 * memperlakukannya sebagai teks, bukan formula. Data asli tidak diubah di DB,
 * hanya representasi ekspor. Angka (amount) tidak disentuh agar tetap numerik.
 */
export function sanitizeExportString(s: string): string {
  if (s.startsWith("'")) return s;
  const trimmed = s.replace(/^[\s\uFEFF]+/, '');
  if (/^[=+\-@]/.test(trimmed)) return `'${s}`;
  return s;
}

function escapeCSV(v: string | number): string {
  if (typeof v === 'number') {
    const s = String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }
  const s = sanitizeExportString(String(v));
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function toCSV(rows: ExportRow[]): string {
  const headers = [t('export.date'), t('export.description'), t('export.amount'), t('export.source'), t('export.note'), t('export.createdAt')];
  const lines = [headers.map(escapeCSV).join(',')];
  for (const r of rows) lines.push(headers.map((h) => escapeCSV(r[h] ?? '')).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function csvBlob(txs: Transaction[]): Blob {
  return new Blob([toCSV(toExportRows(txs))], { type: 'text/csv;charset=utf-8' });
}

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/; // NOSONAR - anchored date check

export type DateRangeError = 'invalid-date' | 'from-after-to';

/**
 * Validasi rentang From/To untuk ekspor (inklusif, YYYY-MM-DD).
 * Return null jika valid/kosong, kode error jika tidak.
 */
export function validateDateRange(from?: string, to?: string): DateRangeError | null {
  const f = (from ?? '').trim();
  const tt = (to ?? '').trim();
  if (!f && !tt) return null;
  for (const d of [f, tt]) {
    if (!d) continue;
    if (!DATE_ISO_RE.test(d)) return 'invalid-date';
    const [ys, ms, ds] = d.split('-');
    const y = Number(ys);
    const m = Number(ms);
    const dd = Number(ds);
    if (m < 1 || m > 12 || dd < 1 || dd > 31) return 'invalid-date';
    // hari valid per bulan (termasuk kabisat), tanpa sensitif timezone
    const dim = new Date(y, m, 0).getDate();
    if (dd > dim) return 'invalid-date';
  }
  if (f && tt && f > tt) return 'from-after-to';
  return null;
}

export function filterByDate(txs: Transaction[], from?: string, to?: string): Transaction[] {
  if (!from && !to) return txs;
  return txs.filter((t) => {
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  });
}

export async function xlsxBlob(txs: Transaction[]): Promise<Blob> {
  const XLSX = await getXLSX();
  const rows = toExportRows(txs);
  const headers = [t('export.date'), t('export.description'), t('export.amount'), t('export.source'), t('export.note'), t('export.createdAt')];
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('export.sheetName'));
  const ab = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ITEMS = 10_000;
export const MAX_AMOUNT = 1_000_000_000_000;

export interface ImportedTransaction {
  description: string;
  amount: number;
  date: string;
  source?: string;
  note?: string;
  createdAt: string;
  rawText?: string;
}

export interface ImportParseResult {
  ok: boolean;
  transactions: ImportedTransaction[];
  skipped: number;
  errors: string[];
}

function isValidISODate(d: string): boolean {
  if (!DATE_ISO_RE.test(d)) return false;
  const [ys, ms, ds] = d.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const dd = Number(ds);
  if (m < 1 || m > 12 || dd < 1 || dd > 31) return false;
  return dd <= new Date(y, m, 0).getDate();
}

function validateImportItem(item: unknown): { tx?: ImportedTransaction; error?: string } {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return { error: 'item bukan objek' };
  const o = item as Record<string, unknown>;
  const desc = o.description;
  if (typeof desc !== 'string' || !desc.trim() || desc.trim().length > 200) return { error: 'deskripsi tidak valid' };
  const amount = o.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return { error: 'nominal tidak valid' };
  const date = o.date;
  if (typeof date !== 'string' || !isValidISODate(date)) return { error: 'tanggal tidak valid' };
  let source: string | undefined;
  if (o.source !== undefined && o.source !== null && o.source !== '') {
    if (typeof o.source !== 'string' || o.source.length > 80) return { error: 'sumber tidak valid' };
    source = o.source.trim() || undefined;
  }
  let note: string | undefined;
  if (o.note !== undefined && o.note !== null && o.note !== '') {
    if (typeof o.note !== 'string' || o.note.length > 200) return { error: 'catatan tidak valid' };
    note = o.note.trim() || undefined;
  }
  let createdAt = new Date().toISOString();
  if (typeof o.createdAt === 'string' && o.createdAt) {
    const dt = new Date(o.createdAt);
    if (!Number.isNaN(dt.getTime())) createdAt = dt.toISOString();
  }
  let rawText: string | undefined;
  if (typeof o.rawText === 'string' && o.rawText) rawText = o.rawText.slice(0, 500);
  return { tx: { description: desc.trim().slice(0, 80), amount, date, source, note, createdAt, rawText } };
}

/**
 * Parse JSON impor secara ketat. Menerima format berversi:
 * { version: 1, transactions: [...] } dan legacy bare array [...].
 * Tidak menghapus data lama; duplikat eksak dalam file di-skip (dedupe).
 * Menolak: JSON rusak, struktur tak dikenal, versi tak dikenal,
 * ukuran berlebih, tipe salah, nominal<=0/NaN/overflow, tanggal invalid.
 */
export function parseImportJSON(raw: string): ImportParseResult {
  if (raw.length > IMPORT_MAX_BYTES) return { ok: false, transactions: [], skipped: 0, errors: ['ukuran file berlebihan'] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, transactions: [], skipped: 0, errors: ['JSON rusak'] };
  }
  let list: unknown;
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    if (o.version !== undefined) {
      if (o.version !== 1) return { ok: false, transactions: [], skipped: 0, errors: ['versi tidak dikenal'] };
      list = o.transactions;
    } else if (Array.isArray(o.transactions)) {
      list = o.transactions;
    } else {
      return { ok: false, transactions: [], skipped: 0, errors: ['struktur tidak dikenal'] };
    }
  } else {
    return { ok: false, transactions: [], skipped: 0, errors: ['struktur tidak dikenal'] };
  }
  if (!Array.isArray(list)) return { ok: false, transactions: [], skipped: 0, errors: ['struktur tidak dikenal'] };
  if (list.length > IMPORT_MAX_ITEMS) return { ok: false, transactions: [], skipped: 0, errors: ['terlalu banyak item'] };
  const txs: ImportedTransaction[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (let i = 0; i < list.length; i++) {
    const { tx, error } = validateImportItem(list[i]);
    if (!tx) {
      errors.push(`item ${i}: ${error}`);
      skipped++;
      continue;
    }
    const key = `${tx.description}|${tx.amount}|${tx.date}|${tx.source ?? ''}|${tx.note ?? ''}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    txs.push(tx);
  }
  return { ok: txs.length > 0, transactions: txs, skipped, errors };
}

export function toJSON(txs: Transaction[]): string {
  return JSON.stringify({ version: 1, app: 'expend', exportedAt: new Date().toISOString(), count: txs.length, transactions: txs.map((tx) => ({ description: tx.description, amount: tx.amount, date: tx.date, source: tx.source, note: tx.note, createdAt: tx.createdAt, rawText: tx.rawText })) }, null, 2);
}

export function jsonBlob(txs: Transaction[]): Blob {
  return new Blob([toJSON(txs)], { type: 'application/json;charset=utf-8' });
}

export function exportFilename(ext: 'csv' | 'xlsx' | 'json', from?: string, to?: string): string {
  const d = new Date().toISOString().slice(0, 10);
  if (from && to) return `expend-${from}_${to}.${ext}`;
  if (from) return `expend-${from}.${ext}`;
  return `expend-${d}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
