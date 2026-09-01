function parseAmt(s: string): number | null {
  const c = s.toLowerCase().replaceAll(/\s/g, '');
  let m: RegExpExecArray | null;
  m = /^([\d.,]+)\s*(jt|juta)$/.exec(c);
  if (m) {
    const n = Number(m[1]!.replaceAll('.', '').replace(',', '.'));
    return Number.isFinite(n) ? n * 1_000_000 : null;
  }
  m = /^([\d.,]+)\s*(rb|ribu|k)$/.exec(c);
  if (m) {
    const n = Number(m[1]!.replaceAll('.', '').replace(',', '.'));
    return Number.isFinite(n) ? n * 1_000 : null;
  }
  m = /^[\d.,]+$/.exec(c);
  if (m) {
    // plain amount: treat both . and , as thousand separators, remove all
    // but keep decimal for 1,5jt already handled above, so safe to strip
    const raw = m[0]!;
    // if contains both . and , use last separator as decimal? For transfer, assume integer
    const cleaned = raw.replaceAll(/[.,]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeAmountRaw(raw: string): string {
  // OCR common misread: O->0, o->0, l/I->1 in numeric context, S->5, B->8
  // only replace when surrounded by digits or separators
  return raw
    .replaceAll(/[O]/g, '0')
    .replaceAll(/[o]/g, '0')
    .replaceAll(/[lI]/g, '1')
    .trim();
}

function extractAmount(text: string): number | null {
  const lines = text.split('\n');
  type Hit = { val: number; lineIdx: number; hasRp: boolean; hasKeyword: boolean; raw: string };
  const hits: Hit[] = [];
  const kw = /tota|juml|nomi|transf|bayar|jumlah/i; // fuzzy
  const rpLineRe = /R\s*P\s*\.?:?|IDR/i;
  const re = /(\d[\d.,]*\s*(?:jt|juta|rb|ribu|k)?)/gi; // NOSONAR - small input
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    const prevLine = idx > 0 ? lines[idx - 1]! : '';
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      let raw = normalizeAmountRaw(m[1]!.trim());
      // skip pure reference-like numbers without Rp (e.g., No. Ref, Trace ID, 6+ digits)
      const digitsOnly = raw.replaceAll(/\D/g, '');
      const isRefLine = /ref|resi|trace|\bID\b/i.test(line);
      if (/^\d{6,}$/.test(digitsOnly) && !rpLineRe.test(line) && (isRefLine || !/[,\.]/.test(raw))) continue;
      // skip date fragments
      if (/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line) && /^\d{1,4}$/.test(raw.replaceAll(/[.,]/g, ''))) {
        const datePart = line.match(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/)?.[0] ?? '';
        if (datePart.replaceAll(/\s/g, '').includes(raw.replaceAll(/\s/g, ''))) continue;
      }
      const v = parseAmt(raw);
      if (!v || v <= 0) continue;
      if (v < 1000 && !/rb|ribu|k|jt|juta/i.test(raw)) {
        const hasRpNearby = rpLineRe.test(line) || rpLineRe.test(prevLine);
        if (!hasRpNearby) continue;
      }
      if (v > 999_999_999 && !rpLineRe.test(line)) continue;
      // if huge and no keyword, skip unless Rp
      if (v > 1_000_000 && !rpLineRe.test(line) && !kw.test(line) && !kw.test(prevLine)) {
        // still allow if it's the only candidate, but deprioritize
        // we push but with low score, filter later via scoring
      }
      const hasRp = rpLineRe.test(line) || rpLineRe.test(prevLine) || /Rp/i.test(line.slice(Math.max(0, m.index - 8), m.index + raw.length + 4));
      const hasKeyword = kw.test(line) || kw.test(prevLine);
      hits.push({ val: v, lineIdx: idx, hasRp, hasKeyword, raw });
    }
  }
  if (!hits.length) return null;
  // also try to find explicit Rp amounts via second pass for confidence
  const rpHits = hits.filter((h) => h.hasRp);
  // score
  let best = hits[0]!;
  let bestScore = best.val * (best.hasRp ? 1.9 : 1) * (best.hasKeyword ? 2.2 : 1);
  for (let i = 1; i < hits.length; i++) {
    const h = hits[i]!;
    const score = h.val * (h.hasRp ? 1.9 : 1) * (h.hasKeyword ? 2.2 : 1);
    if (score > bestScore || (score === bestScore && h.val > best.val)) {
      best = h;
      bestScore = score;
    }
  }
  // if best has no Rp and no keyword, but there is a Rp candidate within 80% of best, prefer Rp
  if (!best.hasRp && !best.hasKeyword && rpHits.length) {
    const bestRp = rpHits.reduce((a, b) => (a.val > b.val ? a : b));
    if (bestRp.val >= best.val * 0.8) return bestRp.val;
  }
  return best.val;
}

function extractDate(text: string): string {
  let ddmmyyyy = new RegExp('(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2,4})').exec(text); // NOSONAR
  if (ddmmyyyy) {
    let d = ddmmyyyy[1]!.padStart(2, '0');
    let m = ddmmyyyy[2]!.padStart(2, '0');
    let y = ddmmyyyy[3]!;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }
  const mmm = /(\d{1,2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\w*\s+(\d{4})/i.exec(text);
  if (mmm) {
    const map: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      mei: '05',
      jun: '06',
      jul: '07',
      agu: '08',
      aug: '08',
      sep: '09',
      okt: '10',
      oct: '10',
      nov: '11',
      des: '12',
      dec: '12',
    };
    const mon = map[mmm[2]!.toLowerCase().slice(0, 3)];
    if (mon) return `${mmm[3]}-${mon}-${mmm[1]!.padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function extractDescription(text: string, hits: { idx: number }[]): string {
  const lines = text.split('\n');
  const descKw = /penerima|kepada|beneficiary|berita|keterangan|tujuan|ke:/i;
  const hitLine = lines.find((l) => descKw.test(l));
  let desc = '';
  if (hitLine) {
    const after = hitLine.split(/:/).slice(1).join(':').trim();
    desc = after || hitLine.replace(/.*?:\s*/, '').trim() || hitLine.trim();
  }
  if (!desc) {
    const amountIdxs = new Set(hits.map((h) => h.idx));
    desc =
      lines.find((l, i) => !amountIdxs.has(i) && l.trim().length > 3 && !/biaya admin/i.test(l))?.trim() ??
      lines.find((l) => l.trim().length > 3 && !/biaya admin/i.test(l))?.trim() ??
      '';
  }
  desc = desc.replaceAll(/\s+/g, ' ').trim() || 'Transfer';
  desc = desc
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 80);
  return desc.replace(/\s+(?:dari|pakai|pake|via)\s+.*$/i, '').trim(); // NOSONAR
}

export function parseReceiptText(text: string): { description: string; amount: number; date: string; rawText: string } | null {
  const rawText = text.slice(0, 500);
  const amount = extractAmount(text);
  if (amount == null) return null;

  const lines = text.split('\n');
  const hits: { idx: number }[] = [];
  const re = /(\d[\d.,]*\s*(?:jt|juta|rb|ribu|k)?)/gi; // NOSONAR
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const v = parseAmt(normalizeAmountRaw(m[1]!.trim()));
      if (v && v > 0) hits.push({ idx });
    }
  }

  return {
    description: extractDescription(text, hits),
    amount,
    date: extractDate(text),
    rawText,
  };
}
