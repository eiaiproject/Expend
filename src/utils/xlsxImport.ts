import { parseSheetsRows, type SheetRow, type SheetsImportResult } from './sheetsImport';

/**
 * XLSX dibaca dinamis: library + worker-nya hanya diunduh saat pengguna
 * memilih file .xlsx, bukan saat aplikasi pertama dibuka.
 *
 * Hanya sheet `Transaksi` yang dipakai. Sheet Pengaturan, Log, dan Antrean
 * berisi data internal/operasional dan tidak boleh ikut menjadi transaksi.
 */
export async function parseSheetsXLSX(file: File): Promise<SheetsImportResult> {
  const { readSheet } = await import('read-excel-file/browser');
  const rows = await readSheet(file, 'Transaksi') as unknown as SheetRow[];
  return parseSheetsRows(rows);
}
