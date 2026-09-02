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
    [t('export.date')]: tx.date,
    [t('export.description')]: tx.description,
    [t('export.amount')]: tx.amount,
    [t('export.source')]: tx.source ?? '',
    [t('export.note')]: tx.note ?? '',
    [t('export.createdAt')]: tx.createdAt,
  }));
}

function escapeCSV(v: string | number): string {
  const s = String(v);
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

export function exportFilename(ext: 'csv' | 'xlsx', from?: string, to?: string): string {
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
