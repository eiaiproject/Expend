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
  const hits: { val: number; hasKeyword: boolean }[] = [];
  const kw = /total|jumlah|nominal|transfer/i;
  const re = /(\d[\d.,]*\s*(?:jt|juta|rb|ribu|k)?)/gi; // NOSONAR - small input
  for (const line of lines) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const v = parseAmt(m[1]!.trim());
      if (v && v > 0) hits.push({ val: v, hasKeyword: kw.test(line) });
    }
  }
  if (!hits.length) return null;
  const filtered = hits.filter((h) => h.hasKeyword);
  const pool = filtered.length ? filtered : hits;
  let max = pool[0]!.val;
  for (let i = 1; i < pool.length; i++) if (pool[i]!.val > max) max = pool[i]!.val;
  return max;
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
  desc = desc.replaceAll(/\s+/g, ' ').trim() || 'Transfer'; // NOSONAR
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
  lines.forEach((line, idx) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const v = parseAmt(m[1]!.trim());
      if (v && v > 0) hits.push({ idx } as any);
    }
  });

  return {
    description: extractDescription(text, hits),
    amount,
    date: extractDate(text),
    rawText,
  };
}
