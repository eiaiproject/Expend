/**
 * Database bank dan e-wallet Indonesia.
 * Digunakan oleh receiptParser dan chatParser untuk mendeteksi sumber dana.
 */

export interface SourceEntry {
  /** Nama tampil */
  name: string;
  /** Pola regex untuk mencocokkan di teks OCR/chat (case-insensitive) */
  patterns: RegExp[];
}

/**
 * Entri yang namanya adalah kata umum bahasa Indonesia sehingga berisiko
 * false-positive saat di-scan pada seluruh teks (mis. "dana darurat" ≠ e-wallet
 * DANA, "kas" ≠ rekening kas). Pengecualian Tunai/Kas dipertahankan karena
 * chatParser sengaja memakainya sebagai fallback sumber tanpa kata depan.
 */
const GENERIC_WORD_SOURCES = new Set(['Dana']);

export const SOURCES: SourceEntry[] = [
  // ─── Bank BUMN ──────────────────────────────────────
  // Sub-brand (Mandiri Taspen, BCA Syariah) DIDAHULUKAN induknya karena
  // pencarian memakai first-match; teks "Bank Mandiri Taspen" harus terdeteksi
  // sebagai Mandiri Taspen, bukan Mandiri.
  { name: 'Mandiri Taspen', patterns: [/\btaspen\b/i, /mandiri\s*taspen/i] },
  { name: 'Mandiri',   patterns: [/bank\s*mandiri/i, /\bmandiri\b/i] },
  { name: 'BRI',       patterns: [/bank\s*rakyat/i, /\bbri\b/i] },
  { name: 'BNI',       patterns: [/bank\s*negara/i, /\bbni46\b/i, /\bbni\b/i] },
  { name: 'BTN',       patterns: [/bank\s*tabungan/i, /\bbtn\b/i] },
  { name: 'BSI',       patterns: [/bank\s*syariah/i, /\bbsi\b/i] },
  { name: 'Bank INA',  patterns: [/bank\s*ina\b/i] },

  // ─── Bank Swasta ────────────────────────────────────
  { name: 'BCA Syariah', patterns: [/bca\s*syariah/i, /bank\s*syariah\s*bca/i] },
  { name: 'BCA',       patterns: [/bank\s*central\s*asia/i, /\bbca\b/i] },
  { name: 'CIMB Niaga', patterns: [/cimb\s*niaga/i, /\bcimb\b/i] },
  { name: 'Danamon',   patterns: [/bank\s*danamon/i, /\bdanamon\b/i] },
  { name: 'Permata',   patterns: [/bank\s*permata/i, /\bpermata\b/i] },
  { name: 'Panin',     patterns: [/bank\s*panin/i, /\bpanin\b/i] },
  { name: 'Mega',      patterns: [/bank\s*mega/i, /\bmega\b/i] },
  // 1.4: pola tanpa \b berisiko false-positive pada sub-string (URL/ID/email).
  { name: 'Maybank',   patterns: [/\bmaybank\b/i] },
  { name: 'Muamalat',  patterns: [/bank\s*muamalat/i, /\bmuamalat\b/i] },
  { name: 'Sinarmas',  patterns: [/\bsinarmas\b/i] },

  // ─── Bank Asing ─────────────────────────────────────
  // 1.3: pola lama memakai 'í' beraksen sehingga "OCBC Niaga" (ASCII) tak cocok.
  // Dipakai [ií] agar dua-duanya cocok tanpa mengandalkan fallback \bocbc\b.
  { name: 'OCBC',      patterns: [/ocbc\s*n[ií]aga/i, /\bocbc\b/i] },
  { name: 'UOB',       patterns: [/uob\s*buana/i, /\buob\b/i] },
  { name: 'HSBC',      patterns: [/\bhsbc\b/i] },
  { name: 'Standard Chartered', patterns: [/standard\s*chartered/i, /\bsc\b/i] },
  { name: 'Citibank',  patterns: [/\bcitibank\b/i, /\bciti\b/i] },
  { name: 'ANZ',       patterns: [/\banz\b/i] },
  { name: 'DBS',       patterns: [/\bdbs\b/i] },
  { name: 'ICBC',      patterns: [/\bicbc\b/i] },

  // ─── Bank Digital ───────────────────────────────────
  { name: 'Jago',      patterns: [/\bjago\b/i, /bank\s*jago/i] },
  { name: 'Neo Commerce', patterns: [/neo\s*commerce/i, /\bneobank\b/i] },
  { name: 'Sea Bank',  patterns: [/sea\s*bank/i, /\bseabank\b/i] },
  { name: 'Bank Neo',  patterns: [/bank\s*neo/i] },
  { name: 'Bank Surya Yudha', patterns: [/\bbanksurya/i] },
  { name: 'Allo Bank', patterns: [/allo\s*bank/i, /\ballobank\b/i] },

  // ─── E-Wallet ───────────────────────────────────────
  { name: 'GoPay',     patterns: [/go\s*pay/i, /\bgopay\b/i, /gopaylater/i] },
  { name: 'OVO',       patterns: [/\bovo\b/i] },
  { name: 'Dana',      patterns: [/\bdana\b/i] },
  { name: 'ShopeePay', patterns: [/shopee\s*pay/i, /\bshopeepay\b/i] },
  { name: 'LinkAja',   patterns: [/link\s*aja/i, /\blinkaja\b/i] },
  { name: 'i.saku',    patterns: [/i\.?saku/i] },
  { name: 'Doku',      patterns: [/\bdoku\b/i] },

  // ─── Fintech / Lending ──────────────────────────────
  { name: 'Flip',      patterns: [/\bflip\b/i] },
  { name: 'Fitco',     patterns: [/\bfitco\b/i] },
  { name: 'Topindo',   patterns: [/\btopindo\b/i] },

  // ─── Kartu ──────────────────────────────────────────
  { name: 'Kartu Kredit', patterns: [/kartu\s*kredit/i, /\bkk\b/i, /credit\s*card/i] },
  { name: 'Kartu Debit',  patterns: [/kartu\s*debit/i, /\bkd\b/i, /debit\s*card/i] },

  // ─── Generic ────────────────────────────────────────
  { name: 'Tunai',     patterns: [/\btunai\b/i, /\bcash\b/i] },
  { name: 'Kas',       patterns: [/\bkas\b/i] },
  { name: 'Transfer Bank', patterns: [/transfer\s*bank/i, /\btf\s*bank/i] },
];

/** True bila teks memakai kata umum sebagai e-wallet (mis. "DANA"/"Dana" resmi). */
function isGenericWordIntentional(name: string, text: string): boolean {
  if (name !== 'Dana') return true;
  // Kata "dana" lowercase semata = kata benda umum ("dana darurat",
  // "dana masuk") ≠ e-wallet DANA. Nama resmi e-wallet ditulis DANA / Dana
  // (kapital), jadi hanya bentuk itulah yang dianggap sumber dana.
  return /\bDANA\b/.test(text) || /\bDana\b/.test(text);
}

/** Cari entri SOURCES pertama yang cocok (sub-brand sudah didahulukan). */
function findSourceIn(text: string): SourceEntry | undefined {
  for (const source of SOURCES) {
    if (!GENERIC_WORD_SOURCES.has(source.name) || isGenericWordIntentional(source.name, text)) {
      if (source.patterns.some((p) => p.test(text))) return source;
    }
  }
  return undefined;
}

/**
 * Deteksi sumber hanya dari database SOURCES (tanpa fallback kapitalisasi).
 * Dipakai chatParser untuk klausa "dari/via/pakai X": X hanya dianggap sumber
 * dana bila memang entitas bank/e-wallet/kas/tunai yang dikenal.
 */
export function detectKnownSource(text: string): string | undefined {
  return findSourceIn(text)?.name;
}

/**
 * Cari sumber dana dari teks.
 * Urutan: keyword eksplisit → header → scan database.
 * Sub-brand (BCA Syariah, Mandiri Taspen) didahulukan di SOURCES.
 */
export function detectSource(text: string): string | undefined {
  const lines = text.split('\n');

  // 1. Cek keyword eksplisit: dari/via/pakai/from X (highest priority)
  const srcKwRe = /(?:dari|via|pakai|pake|from)\s+([A-Za-z0-9 ]+?)(?:\n|$|[.,])/i; // NOSONAR - bounded, anchored
  const srcMatch = srcKwRe.exec(text);
  let raw: string | undefined;
  if (srcMatch?.[1]) {
    raw = srcMatch[1]!.trim();
    const dbMatch = findSourceIn(raw);
    if (dbMatch) return dbMatch.name;
    // "Dari 1234567890 a.n. BUDI SANTOSO" pada resi = info pengirim, BUKAN
    // sumber dana si pengguna. Kalau klausa berisi angka (rekening/no HP),
    // jangan pakai fallback nama - lanjut ke header/scan di bawah.
    if (/\d/.test(raw)) raw = undefined;
  }
  if (raw) {
    // Hanya akronim kapital yang diterima mentah ("DARI QRIS"); nama orang
    // ("Dari Rina Wulandari") BUKAN sumber dana - lanjut ke header/scan.
    // (Paralel temuan 3.1 chatParser: klausa dari + nama = penjual/pengirim.)
    if (raw === raw.toUpperCase() && raw.length > 1) return raw;
    raw = undefined;
  }

  // 2. Cek header (first 2 lines) - usually the app/bank name
  for (let i = 0; i < Math.min(2, lines.length); i++) {
    const header = lines[i]!.trim().replace(/^[©@§£€*#]+\s*/, '');
    if (!header || header.length < 2) continue;
    const dbMatch = findSourceIn(header);
    if (dbMatch) return dbMatch.name;
  }

  // 3. Scan teks dengan database
  return findSourceIn(text)?.name;
}
