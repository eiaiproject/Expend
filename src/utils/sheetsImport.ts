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

export const SHEETS_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const SHEETS_IMPORT_MAX_ITEMS = 10_000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

type SheetField = 'date' | 'description' | 'amount' | 'source' | 'note';

/**
 * Header yang dikenali, dinormalisasi (lowercase, tanpa tanda baca).
 * Mencakup CSV `/export` bot, CSV Download Sheets, dan CSV ekspor Expend
 * sendiri (id/en) — posisi kolom bebas, hanya nama yang dicocokkan.
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

/** Parser CSV RFC4180 minimal: hormati quote `"`, escape `""`, CRLF. */
export function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c === '\r') {
      // Abaikan; `\n` yang mengakhiri baris.
    } else {
      cell += c;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
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
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replaceAll('.', '');
  } else if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replaceAll(',', '');
  } else if (s.includes('.') && s.includes(',')) {
    s = s.replaceAll('.', '').replace(',', '.');
  } else if (/,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replaceAll(',', '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded <= 0 || rounded > MAX_AMOUNT) return null;
  return rounded;
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
 * Parse CSV hasil download Google Sheets (atau CSV `/export` bot) menjadi
 * transaksi. Hanya 5 kolom yang dipakai — `ID`, `Input`, `Status`,
 * `Dicatat Pada` diabaikan di titik pemetaan header. Baris `Perlu dicek`
 * ikut masuk (tanpa filter status) dengan `source` kosong.
 */
export function parseSheetsCSV(raw: string): SheetsImportResult {
  const fail = (errors: string[]): SheetsImportResult => ({ ok: false, transactions: [], skipped: 0, errors });
  if (raw.length > SHEETS_IMPORT_MAX_BYTES) return fail(['ukuran file berlebihan']);
  const text = raw.replace(/^\uFEFF/, '');
  if (!text.trim()) return fail(['file kosong']);
  const rows = parseCSVRows(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (rows.length < 2) return fail(['header tidak dikenal: butuh kolom Tanggal, Penerima, Nominal, Sumber Dana, Catatan']);

  const header = rows[0]!.map(normalizeHeader);
  const idx: Partial<Record<SheetField, number>> = {};
  header.forEach((h, i) => {
    const f = HEADER_MAP[h];
    if (f && idx[f] === undefined) idx[f] = i;
  });
  const missing = (['date', 'description', 'amount', 'source', 'note'] as const).filter((f) => idx[f] === undefined);
  if (missing.length) {
    return fail(['header tidak dikenal: butuh kolom Tanggal, Penerima, Nominal, Sumber Dana, Catatan']);
  }

  const data = rows.slice(1);
  if (data.length > SHEETS_IMPORT_MAX_ITEMS) return fail(['terlalu banyak item']);

  const createdAt = new Date().toISOString();
  const txs: SheetsImportedTransaction[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = 0; i < data.length; i++) {
    const lineNo = i + 2;
    const cells = data[i]!;
    const get = (f: SheetField): string => (cells[idx[f]!] ?? '').trim();

    const date = parseSheetsDateCell(get('date'));
    if (!date) {
      errors.push(`baris ${lineNo}: tanggal tidak valid`);
      skipped++;
      continue;
    }
    const descRaw = get('description').replace(/^'+/, '').trim();
    if (!descRaw || descRaw.length > 200) {
      errors.push(`baris ${lineNo}: deskripsi tidak valid`);
      skipped++;
      continue;
    }
    const amount = parseSheetsAmountCell(get('amount'));
    if (!amount) {
      errors.push(`baris ${lineNo}: nominal tidak valid`);
      skipped++;
      continue;
    }
    const source = parseSheetsSourceCell(get('source'));
    const note = parseSheetsNoteCell(get('note'));
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
