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

export const SOURCES: SourceEntry[] = [
  // ─── Bank BUMN ──────────────────────────────────────
  { name: 'Mandiri',   patterns: [/bank\s*mandiri/i, /\bmandiri\b/i] },
  { name: 'BRI',       patterns: [/bank\s*rakyat/i, /\bbri\b/i] },
  { name: 'BNI',       patterns: [/bank\s*negara/i, /\bbni46\b/i, /\bbni\b/i] },
  { name: 'BTN',       patterns: [/bank\s*tabungan/i, /\bbtn\b/i] },
  { name: 'BSI',       patterns: [/bank\s*syariah/i, /\bbsi\b/i] },
  { name: 'Bank INA',  patterns: [/bank\s*ina\b/i] },

  // ─── Bank Swasta ────────────────────────────────────
  { name: 'BCA',       patterns: [/bank\s*central\s*asia/i, /\bbca\b/i] },
  { name: 'BCA Syariah', patterns: [/bca\s*syariah/i] },
  { name: 'CIMB Niaga', patterns: [/cimb\s*niaga/i, /\bcimb\b/i] },
  { name: 'Danamon',   patterns: [/bank\s*danamon/i, /\bdanamon\b/i] },
  { name: 'Permata',   patterns: [/bank\s*permata/i, /\bpermata\b/i] },
  { name: 'Panin',     patterns: [/bank\s*panin/i, /\bpanin\b/i] },
  { name: 'Mega',      patterns: [/bank\s*mega/i, /\bmega\b/i] },
  { name: 'Maybank',   patterns: [/maybank/i] },
  { name: 'Muamalat',  patterns: [/bank\s*muamalat/i, /\bmuamalat\b/i] },
  { name: 'Sinarmas',  patterns: [/sinarmas/i] },
  { name: 'Mandiri Taspen', patterns: [/taspen/i] },

  // ─── Bank Asing ─────────────────────────────────────
  { name: 'OCBC',      patterns: [/ocbc\s*níaga/i, /\bocbc\b/i] },
  { name: 'UOB',       patterns: [/uob\s*buana/i, /\buob\b/i] },
  { name: 'HSBC',      patterns: [/hsbc/i] },
  { name: 'Standard Chartered', patterns: [/standard\s*chartered/i, /\bsc\b/i] },
  { name: 'Citibank',  patterns: [/citibank/i, /\bciti\b/i] },
  { name: 'ANZ',       patterns: [/\banz\b/i] },
  { name: 'DBS',       patterns: [/dbs/i] },
  { name: 'ICBC',      patterns: [/icbc/i] },

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
  { name: 'Transfer Bank', patterns: [/transfer\s*bank/i, /\btf\s*bank/i] },
];

/**
 * Cari sumber dana dari teks.
 * Urutan: brand spesifik lebih prioritas daripada generic.
 */
export function detectSource(text: string): string | undefined {
  const lines = text.split('\n');

  // 1. Cek keyword eksplisit: dari/via/pakai X (highest priority)
  const srcKwRe = /(?:dari|via|pakai|pake)\s+([A-Za-z0-9 ]+?)(?:\n|$|[.,])/i; // NOSONAR - bounded, anchored
  const srcMatch = srcKwRe.exec(text);
  if (srcMatch?.[1]) {
    const raw = srcMatch[1]!.trim();
    const dbMatch = SOURCES.find((s) => s.patterns.some((p) => p.test(raw)));
    if (dbMatch) return dbMatch.name;
    if (raw === raw.toUpperCase() && raw.length > 1) return raw;
    return raw.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  // 2. Cek header (first 2 lines) — usually the app/bank name
  for (let i = 0; i < Math.min(2, lines.length); i++) {
    const header = lines[i]!.trim().replace(/^[©@§£€*#]+\s*/, '');
    if (!header || header.length < 2) continue;
    const dbMatch = SOURCES.find((s) => s.patterns.some((p) => p.test(header)));
    if (dbMatch) return dbMatch.name;
  }

  // 3. Scan teks dengan database
  for (const source of SOURCES) {
    if (source.patterns.some((p) => p.test(text))) {
      return source.name;
    }
  }

  return undefined;
}
