import { MAX_AMOUNT, isValidISODate } from './export';
import { parseDMYDate } from './chatParser';
import { detectKnownSource } from './sources';

export interface SheetsImportedTransaction {
  description: string;
  amount: number;
  date: string;
  source?: string;
  note?: string;
  createdAt: string;
}

export interface SheetsImportResult {
  ok: boolean;
  transactions: SheetsImportedTransaction[];
  skipped: number;
  errors: string[];
}

export type SheetCell = string | number | boolean | Date | null | undefined;
export type SheetRow = readonly SheetCell[];

export const SHEETS_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const SHEETS_IMPORT_MAX_ITEMS = 10_000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

type SheetField = 'date' | 'description' | 'amount' | 'source' | 'note';

/**
 * Header yang dikenali, dinormalisasi (lowercase, tanpa tanda baca).
 * Mencakup CSV `/export` bot, CSV Download Sheets, XLSX Spending, dan CSV
 * ekspor Expend sendiri (id/en), posisi kolom bebas, hanya nama yang dicocokkan.
 */
const HEADER_MAP: Record<string, SheetField> = {
  tanggal: 'date',
  date: 'date',
  penerima: 'description',
  description: 'description',
  deskripsi: 'description',
  nominal: 'amount',
  amount: 'amount',
  jumlah: 'amount',
  'sumber dana': 'source',
  sumber: 'source',
  source: 'source',
  catatan: 'note',
  note: 'note',
  notes: 'note',
};

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\uFEFF'"]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cellText(cell: SheetCell): string {
  if (cell === null || cell === undefined || cell instanceof Date) return '';
  return String(cell);
}

interface CsvAcc {
  rows: string[][];
  row: string[];
  cell: string;
  inQuotes: boolean;
}

function csvPushCell(acc: CsvAcc): void {
  acc.row.push(acc.cell);
  acc.cell = '';
}

function csvEndRow(acc: CsvAcc): void {
  csvPushCell(acc);
  acc.rows.push(acc.row);
  acc.row = [];
}

/** Satu karakter dalam mode quote. Kembalian: indeks baru (maju 1 bila `""`). */
function csvFeedQuoted(acc: CsvAcc, text: string, i: number): number {
  const c = text[i]!;
  if (c !== '"') {
    acc.cell += c;
    return i;
  }
  if (text[i + 1] === '"') {
    acc.cell += '"';
    return i + 1;
  }
  acc.inQuotes = false;
  return i;
}

function csvFeedPlain(acc: CsvAcc, c: string): void {
  if (c === '"') acc.inQuotes = true;
  else if (c === ',') csvPushCell(acc);
  else if (c === '\n') csvEndRow(acc);
  else if (c !== '\r') acc.cell += c;
}

/** Parser CSV RFC4180 minimal: hormati quote `"`, escape `""`, CRLF. */
export function parseCSVRows(text: string): string[][] {
  const acc: CsvAcc = { rows: [], row: [], cell: '', inQuotes: false };
  // `while` (bukan `for`): indeks maju bervariasi (`""` = 2 char) sehingga
  // counter di-update manual di body tanpa melanggar S2310.
  let i = 0;
  while (i < text.length) {
    if (acc.inQuotes) {
      i = csvFeedQuoted(acc, text, i) + 1;
    } else {
      csvFeedPlain(acc, text[i]!);
      i += 1;
    }
  }
  csvEndRow(acc);
  return acc.rows;
}

/**
 * Tanggal sel Sheets → `YYYY-MM-DD`.
 * Menerima ISO (`2026-09-15`), serial Excel (`46266.79` → tanggal kalender),
 * dan format tampil Sheets (`15 Sep 2026`, `15/09/2026`) via `parseDMYDate`.
 */
export function parseSheetsDateCell(raw: string): string | null {
  const s = raw.replace(/^'+/, '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isValidISODate(s) ? s : null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 20000 && n <= 80000) {
      const iso = new Date(EXCEL_EPOCH_UTC + Math.floor(n) * DAY_MS).toISOString().slice(0, 10);
      return isValidISODate(iso) ? iso : null;
    }
    return null;
  }
  return parseDMYDate(s) ?? null;
}

/**
 * `read-excel-file` mengembalikan Date pada tengah malam UTC untuk sel tanggal.
 * Komponen UTC dipakai agar tanggal tidak bergeser satu hari di zona waktu
 * barat/timur; fallback string menangani sel yang tidak terdeteksi sebagai Date.
 */
function dateFromCell(cell: SheetCell): string | null {
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    const iso = `${cell.getUTCFullYear()}-${String(cell.getUTCMonth() + 1).padStart(2, '0')}-${String(cell.getUTCDate()).padStart(2, '0')}`;
    return isValidISODate(iso) ? iso : null;
  }
  return parseSheetsDateCell(cellText(cell));
}

/** Samakan varian pemisah ribuan/desimal ID ke bentuk `Number`-able. */
function stripThousandSeparators(s: string): string {
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return s.replaceAll('.', '');
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return s.replaceAll(',', '');
  if (s.includes('.') && s.includes(',')) return s.replaceAll('.', '').replace(',', '.');
  if (/,\d{1,2}$/.test(s)) return s.replace(',', '.');
  return s.replaceAll(',', '');
}

/**
 * Nominal sel Sheets → rupiah bulat.
 * Menerima `14603`, `14.603` (ribu ID), `14,603` (ribu koma), `14603,0`
 * (desimal koma dari serial float), dan prefix `Rp`/`'` formula-guard.
 */
export function parseSheetsAmountCell(raw: string): number | null {
  let s = raw.replace(/^'+/, '').trim();
  if (!s) return null;
  s = s
    .replace(/^(?:rp|idr)\.?\s*/i, '')
    .replace(/[\s\u00A0\uFEFF]/g, '');
  if (!/^[\d.,]+$/.test(s)) return null;
  const n = Number(stripThousandSeparators(s));
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded <= 0 || rounded > MAX_AMOUNT) return null;
  return rounded;
}

function amountFromCell(cell: SheetCell): number | null {
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) return null;
    const rounded = Math.round(cell);
    return rounded > 0 && rounded <= MAX_AMOUNT ? rounded : null;
  }
  return parseSheetsAmountCell(cellText(cell));
}

/**
 * Sumber dana sel Sheets → kanonis atau `undefined` (dihilangkan).
 * Kosong/`Belum diisi`/tak dikenal → `undefined`, sesuai keputusan impor.
 */
export function parseSheetsSourceCell(raw: string): string | undefined {
  const s = raw.replace(/^'+/, '').trim();
  if (!s || s.toLowerCase() === 'belum diisi') return undefined;
  return detectKnownSource(s);
}

export function parseSheetsNoteCell(raw: string): string | undefined {
  const s = raw.replace(/^'+/, '').trim();
  if (!s) return undefined;
  return s.slice(0, 200);
}

/**
 * Parse baris spreadsheet (CSV atau XLSX) menjadi transaksi. Hanya 5 kolom
 * yang dipakai; `ID`, `Input`, `Status`, `Dicatat Pada` diabaikan di titik
 * pemetaan header. Baris `Perlu dicek` ikut masuk (tanpa filter status) dengan
 * `source` kosong.
 */
export function parseSheetsRows(rows: readonly SheetRow[]): SheetsImportResult {
  const fail = (errors: string[]): SheetsImportResult => ({ ok: false, transactions: [], skipped: 0, errors });
  const nonEmpty = rows.filter((r) => r.some((c) => cellText(c).trim() !== ''));
  if (nonEmpty.length === 0) return fail(['file kosong']);
  if (nonEmpty.length < 2) return fail(['header tidak dikenal: butuh kolom Tanggal, Penerima, Nominal, Sumber Dana, Catatan']);

  const header = nonEmpty[0]!.map((c) => normalizeHeader(cellText(c)));
  const idx: Partial<Record<SheetField, number>> = {};
  header.forEach((h, i) => {
    const f = HEADER_MAP[h];
    if (f && idx[f] === undefined) idx[f] = i;
  });
  const missing = (['date', 'description', 'amount', 'source', 'note'] as const).filter((f) => idx[f] === undefined);
  if (missing.length) {
    return fail(['header tidak dikenal: butuh kolom Tanggal, Penerima, Nominal, Sumber Dana, Catatan']);
  }

  const data = nonEmpty.slice(1);
  if (data.length > SHEETS_IMPORT_MAX_ITEMS) return fail(['terlalu banyak item']);

  const createdAt = new Date().toISOString();
  const txs: SheetsImportedTransaction[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = 0; i < data.length; i++) {
    const lineNo = i + 2;
    const cells = data[i]!;
    const get = (f: SheetField): SheetCell => cells[idx[f]!];

    const date = dateFromCell(get('date'));
    if (!date) {
      errors.push(`baris ${lineNo}: tanggal tidak valid`);
      skipped++;
      continue;
    }
    const descRaw = cellText(get('description')).replace(/^'+/, '').trim();
    if (!descRaw || descRaw.length > 200) {
      errors.push(`baris ${lineNo}: deskripsi tidak valid`);
      skipped++;
      continue;
    }
    const amount = amountFromCell(get('amount'));
    if (!amount) {
      errors.push(`baris ${lineNo}: nominal tidak valid`);
      skipped++;
      continue;
    }
    const source = parseSheetsSourceCell(cellText(get('source')));
    const note = parseSheetsNoteCell(cellText(get('note')));
    const tx: SheetsImportedTransaction = {
      description: descRaw.slice(0, 80),
      amount,
      date,
      source,
      note,
      createdAt,
    };
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

export function parseSheetsCSV(raw: string): SheetsImportResult {
  const fail = (errors: string[]): SheetsImportResult => ({ ok: false, transactions: [], skipped: 0, errors });
  if (raw.length > SHEETS_IMPORT_MAX_BYTES) return fail(['ukuran file berlebihan']);
  const text = raw.replace(/^\uFEFF/, '');
  if (!text.trim()) return fail(['file kosong']);
  return parseSheetsRows(parseCSVRows(text));
}
