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
    const n = Number(m[0]!.replaceAll('.', '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractAmount(text: string): number | null {
  const lines = text.split('\n');
  type Hit = { val: number; line: string; hasRp: boolean; hasKeyword: boolean; raw: string };
  const hits: Hit[] = [];
  const kw = /tota|juml|nomi|transf|bayar/i; // fuzzy for OCR misread
  const re = /(\d[\d.,]*\s*(?:jt|juta|rb|ribu|k)?)/gi; // NOSONAR - small input
  const rpRe = /Rp\s*([\d.,]+)/i;
  for (const line of lines) {
    // skip lines that are clearly reference numbers: long digits without Rp and length > 10
    const isRef = /^\s*\d{10,}\s*$/.test(line.trim()) && !/Rp/i.test(line);
    if (isRef) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const raw = m[1]!.trim();
      // skip date fragments: if line contains date pattern and raw is part of it
      if (/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line) && /^\d{1,4}$/.test(raw.replace(/[.,]/g, ''))) {
        const datePart = line.match(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/)?.[0] ?? '';
        if (datePart.includes(raw.replace(/\s/g, ''))) continue;
      }
      const v = parseAmt(raw);
      if (!v || v <= 0) continue;
      // filter tiny numbers that are likely not amount (e.g., 08 from date)
      if (v < 1000 && !/rb|ribu|k|jt|juta/i.test(raw)) {
        // allow if has Rp
        if (!/Rp/i.test(line.slice(Math.max(0, m.index - 5), m.index + raw.length + 5))) continue;
      }
      // filter huge reference
      if (v > 999_999_999 && !/Rp/i.test(line)) continue;
      const hasRp = /Rp/i.test(line.slice(Math.max(0, m.index - 6), m.index + raw.length + 2));
      const hasKeyword = kw.test(line);
      // also check Rp regex more precisely
      const rpMatch = rpRe.exec(line);
      const isRpAmount = rpMatch ? parseAmt(rpMatch[1]!.trim()) === v : hasRp;
      hits.push({ val: v, line, hasRp: isRpAmount, hasKeyword, raw });
    }
  }
  if (!hits.length) return null;
  // score: base val, boost for Rp (x1.8) and keyword (x2)
  let best = hits[0]!;
  let bestScore = best.val * (best.hasRp ? 1.8 : 1) * (best.hasKeyword ? 2 : 1);
  for (let i = 1; i < hits.length; i++) {
    const h = hits[i]!;
    const score = h.val * (h.hasRp ? 1.8 : 1) * (h.hasKeyword ? 2 : 1);
    if (score > bestScore || (score === bestScore && h.val > best.val)) {
      best = h;
      bestScore = score;
    }
  }
  // if best is still without Rp and without keyword but there is a Rp candidate within 20% lower, prefer Rp
  // already handled by scoring
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
      const v = parseAmt(m[1]!.trim());
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
