import * as XLSX from 'xlsx';
import type { Transaction } from '../db/db';

export type ExportRow = { Tanggal: string; Deskripsi: string; Jumlah: number; Sumber: string; Catatan: string; Dibuat: string };

export function toExportRows(txs: Transaction[]): ExportRow[] {
  return txs.map((t) => ({
    Tanggal: t.date,
    Deskripsi: t.description,
    Jumlah: t.amount,
    Sumber: t.source ?? '',
    Catatan: t.note ?? '',
    Dibuat: t.createdAt,
  }));
}

function escapeCSV(v: string | number): string {
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function toCSV(rows: ExportRow[]): string {
  const header = ['Tanggal', 'Deskripsi', 'Jumlah', 'Sumber', 'Catatan', 'Dibuat'];
  const lines = [header.map(escapeCSV).join(',')];
  for (const r of rows) lines.push([r.Tanggal, r.Deskripsi, r.Jumlah, r.Sumber, r.Catatan, r.Dibuat].map(escapeCSV).join(','));
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

export function xlsxBlob(txs: Transaction[]): Blob {
  const rows = toExportRows(txs);
  const ws = XLSX.utils.json_to_sheet(rows, { header: ['Tanggal', 'Deskripsi', 'Jumlah', 'Sumber', 'Catatan', 'Dibuat'] });
  ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
  const ab = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
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
