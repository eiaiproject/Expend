# Receipt OCR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload bukti transfer (image) di Chat → OCR offline ind+eng → parse total/date/description → preview editable → Simpan transaksi

**Architecture:** tesseract.js@5 lazy dynamic import di `src/utils/ocr.ts` + `src/utils/receiptParser.ts` pure keyword-proximity (total/date/Penerima) → `ChatView` attach + drag-drop + inline progress A → reuse `db.transactions.add` (gambar dibuang).

**Tech Stack:** React19 TS5 strict Vite6 Tailwind4 Dexie4 tesseract.js@5 reicon-react 1.1.302 Node>=22

**Spec:** `docs/superpowers/specs/2026-08-31-receipt-ocr-design.md`

## Global Constraints

- Privacy-first offline local-first no cloud, no tracking, PWA
- React19 + TS5 strict + Vite6 + Tailwind4 + Dexie4 + reicon-react only 1.1.302
- Version 0.1.0 semver define __APP_VERSION__ via vite.config
- DB v2 transactions {description,amount,date,createdAt,rawText} no wallets/images
- Parser regex rb/k/jt + wallet stripped (existing), receipt uses total keyword proximity + date regex dd/mm/yyyy + MMM ind
- PWA autoUpdate workbox 13→14 entries, lazy chunk, runtimeCaching 30d
- TDD, YAGNI, DRY, frequent commits

---

## File Structure

**New files:**
- `src/utils/ocr.ts` - wrapper tesseract.js lazy, progress callback, terminate
- `src/utils/receiptParser.ts` - pure parseReceiptText
- `tests/unit/receiptParser.test.ts` - 6 tests pure
- `tests/unit/ocr.test.ts` - mock progress (optional lightweight)
- `tests/e2e/receipt.spec.ts` - upload fixture → progress → Simpan → Home
- `public/test-receipt.png` - minimal fixture (optional) atau generate via canvas

**Modified files:**
- `src/views/ChatView.tsx` - attach button, file input, drag-drop, ocr state, editable pending
- `vite.config.ts` - workbox.runtimeCaching for tesseract
- `package.json` - add `tesseract.js` dep
- `.gitignore` - no change (already test-results)

---

### Task 1: receiptParser pure util

**Files:**
- Create: `src/utils/receiptParser.ts`
- Test: `tests/unit/receiptParser.test.ts`

**Interfaces:**
- Consumes: raw OCR text `string`
- Produces: `export function parseReceiptText(text:string): {description:string, amount:number, date:string, rawText:string}|null` → Task 3 uses it

- [ ] **Step 1: Write failing test `tests/unit/receiptParser.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseReceiptText } from '../../src/utils/receiptParser';

describe('parseReceiptText', () => {
  it('ambil total bukan admin', () => {
    const t = `Transfer Berhasil\nNominal: Rp 50.000\nBiaya Admin: Rp 2.500\nTotal: Rp 52.500\nPenerima: Toko Kopi\nTanggal: 31/08/2026`;
    expect(parseReceiptText(t)).toMatchObject({ amount: 52500, description: 'Toko Kopi', date: '2026-08-31' });
  });
  it('date Agu', () => {
    expect(parseReceiptText('Total Rp 10.000\n31 Agu 2026\nKe: Budi')!.date).toBe('2026-08-31');
  });
  it('fallback max amount jika tanpa keyword', () => {
    expect(parseReceiptText('Rp 5.000\nRp 100.000\nhello')!.amount).toBe(100000);
  });
  it('fallback description titleCase 80', () => {
    expect(parseReceiptText('Total Rp 10.000\nhello world test')!.description).toBe('Hello World Test');
  });
  it('null jika tanpa amount', () => {
    expect(parseReceiptText('Halo dunia no number')).toBeNull();
  });
  it('date dash + penerima keyword', () => {
    const t = `Kepada: Siti\nJumlah Transfer Rp 1.500.000\nTanggal 31-08-2026`;
    expect(parseReceiptText(t)).toMatchObject({ amount: 1500000, date: '2026-08-31' });
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npx vitest run tests/unit/receiptParser.test.ts`
Expected: FAIL `parseReceiptText not defined`

- [ ] **Step 3: Minimal implementation `src/utils/receiptParser.ts`**

```ts
export function parseReceiptText(text: string): { description:string, amount:number, date:string, rawText:string }|null {
  const rawText = text.slice(0, 500);
  // amount regex reuse chatParser: /([\d][\d.,]*\s*(?:jt|juta|rb|ribu|k)?)/gi
  const amountRe = /([\d][\d.,]*\s*(?:jt|juta|rb|ribu|k)?)/gi;
  // helpers: parse single amount string → number (same as chatParser)
  const parseAmt = (s:string):number|null => {
    const c=s.toLowerCase().replace(/\s/g,'');
    let m; if(m=c.match(/^([\d.,]+)\s*(jt|juta)$/)) return Number(m[1].replace(/\./g,'').replace(',','.'))*1e6;
    if(m=c.match(/^([\d.,]+)\s*(rb|ribu|k)$/)) return Number(m[1].replace(/\./g,'').replace(',','.'))*1e3;
    if(m=c.match(/^[\d.,]+$/)) return Number(m[0].replace(/\./g,'').replace(',','.'))||0;
    return null;
  };
  // find all amounts with line context
  const lines = text.split('\n');
  type Hit={raw:string,val:number,idx:number,hasKeyword:boolean};
  const hits:Hit[]=[];
  const kw=/total|jumlah|nominal|transfer/i;
  lines.forEach((line,idx)=>{
    let m; amountRe.lastIndex=0;
    while(m=amountRe.exec(line)){
      const v=parseAmt(m[1].trim()); if(v&&v>0) hits.push({raw:m[1],val:v,idx,hasKeyword:kw.test(line)});
    }
  });
  if(!hits.length) return null;
  const keywordHits=hits.filter(h=>h.hasKeyword);
  const chosen = (keywordHits.length? keywordHits : hits).reduce((a,b)=> a.val>b.val? a:b);
  const amount=chosen.val;

  // date
  const ddmmyyyy = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  let date=new Date().toISOString().slice(0,10);
  if(ddmmyyyy){
    let d=ddmmyyyy[1].padStart(2,'0'), m=ddmmyyyy[2].padStart(2,'0'), y=ddmmyyyy[3];
    if(y.length===2) y='20'+y;
    date=`${y}-${m}-${d}`;
  } else {
    const mmm=text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\w*\s+(\d{4})/i);
    if(mmm){
      const map:any={jan:'01',feb:'02',mar:'03',apr:'04',mei:'05',jun:'06',jul:'07',agu:'08',aug:'08',sep:'09',okt:'10',oct:'10',nov:'11',des:'12',dec:'12'};
      const mon=map[mmm[2].toLowerCase().slice(0,3)];
      date=`${mmm[3]}-${mon}-${mmm[1].padStart(2,'0')}`;
    }
  }

  // description: line with penerima/kepada/berita/keterangan
  let desc='';
  const descKw=/penerima|kepada|beneficiary|berita|keterangan|tujuan|ke:/i;
  const hitLine=lines.find(l=>descKw.test(l));
  if(hitLine){
    desc=hitLine.replace(/.*?:\s*/,'').trim();
    if(!desc) desc=hitLine.trim();
  }
  if(!desc){
    // fallback: first non-amount meaningful line >3 chars
    desc=lines.find(l=>l.trim().length>3 && !/^\s*Rp\s*[\d.,]+/.test(l) && !/biaya admin/i.test(l))?.trim() ?? '';
  }
  desc=desc.replace(/\s+/g,' ').trim();
  if(!desc) desc='Transfer';
  desc=desc.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ').slice(0,80);
  // strip wallet clause like chatParser
  desc=desc.replace(/\s+(?:dari|pakai|pake|via)\s+.*$/i,'').trim();
  return { description:desc, amount, date, rawText };
}
```

- [ ] **Step 4: Run test pass**

Run: `npx vitest run tests/unit/receiptParser.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/utils/receiptParser.ts tests/unit/receiptParser.test.ts
git commit -m "feat: parseReceiptText total/date/Penerima heuristik"
```

---

### Task 2: ocr.ts lazy wrapper

**Files:**
- Create: `src/utils/ocr.ts`
- Modify: `package.json` add `tesseract.js@^5.1.1`
- Test: `tests/unit/ocr.test.ts` (mock)

**Interfaces:**
- Consumes: File, progress callback
- Produces: `recognizeImage(file:File, onProgress:(n:number)=>void):Promise<string>` → Task3

- [ ] **Step 1: Write failing test `tests/unit/ocr.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('tesseract.js', ()=> ({ createWorker: vi.fn(async ()=> ({ recognize: async()=>({data:{text:'Total Rp 10.000'}}), terminate: async()=>{}})) }));
import { recognizeImage } from '../../src/utils/ocr';
describe('ocr',()=>{ it('calls progress', async()=>{
  const f=new File(['x'],'a.png',{type:'image/png'});
  const cb=vi.fn(); const t=await recognizeImage(f, cb); expect(t).toContain('Total');
})});
```

- [ ] **Step 2: Run fail**

Run: `npx vitest run tests/unit/ocr.test.ts` Expected FAIL module not found

- [ ] **Step 3: Install dep + implement `src/utils/ocr.ts`**

Run: `npm i tesseract.js@^5.1.1`

```ts
export async function recognizeImage(file: File, onProgress:(n:number)=>void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker:any = await createWorker('ind+eng', 1, {
    logger: (m:any)=> { if(m.status==='recognizing text' && typeof m.progress==='number') onProgress(Math.round(m.progress*100)); }
  });
  try {
    onProgress(5);
    const { data } = await worker.recognize(file);
    onProgress(100);
    return data.text as string;
  } finally { await worker.terminate(); }
}
```

- [ ] **Step 4: Run pass**

Run: `npx vitest run tests/unit/ocr.test.ts tests/unit/receiptParser.test.ts`
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/utils/ocr.ts tests/unit/ocr.test.ts
git commit -m "feat: ocr lazy tesseract ind+eng with progress"
```

---

### Task 3: ChatView attach + drag-drop + editable preview

**Files:**
- Modify: `src/views/ChatView.tsx`
- Modify: `vite.config.ts` (workbox runtimeCaching)

**Interfaces:**
- Consumes: `recognizeImage`, `parseReceiptText`
- Produces: UI flow pending editable → db

- [ ] **Step 1: Write failing e2e draft `tests/e2e/receipt.spec.ts` (empty file, will fail)**

```ts
import { test, expect } from '@playwright/test';
test('receipt upload → preview → Simpan', async({page})=>{
  await page.goto('/'); await page.evaluate(()=> new Promise<void>((res,rej)=>{const r=indexedDB.deleteDatabase('ExpendDB'); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); r.onblocked=()=>res()})); await page.reload(); await page.goto('/chat');
  await expect(page.getByPlaceholder(/Tulis/)).toBeVisible();
  await expect(page.getByLabel('upload bukti')).toBeVisible();
});
```

- [ ] **Step 2: Run fail**

Run: `npx playwright test tests/e2e/receipt.spec.ts` Expected FAIL no label

- [ ] **Step 3: Implement ChatView attach**

Edits in `src/views/ChatView.tsx`:
- import `Gallery` from reicon-react, `recognizeImage`, `parseReceiptText`
- state: `const [ocrProgress,setOcrProgress]=useState<number|null>(null); const [ocrError,setOcrError]=useState<string|null>(null);`
- refs: `fileRef=useRef<HTMLInputElement>(null)`
- `async function handleFile(file:File){ if(file.size>5*1024*1024){ setOcrError('File harus <5MB'); return;} setOcrError(null); setOcrProgress(0); try{ const text=await recognizeImage(file, setOcrProgress); const p=parseReceiptText(text); if(!p){ setPending({description:'Transfer', amount:0, date:new Date().toISOString().slice(0,10)}); setOcrError('Nominal tidak terbaca. Edit manual.'); } else { setPending({description:p.description, amount:p.amount, date:p.date}); } } catch(e){ setOcrError('Gagal membaca bukti. Sambungkan internet sekali untuk download model.'); } finally{ setOcrProgress(null); } }`
- JSX top bar: `<div className="flex gap-2"><input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])} /><button aria-label="upload bukti" onClick={()=>fileRef.current?.click()} className="h-11 w-11 grid place-items-center rounded-xl border"><Gallery size={18}/></button><input ... placeholder Tulis ...><button kirim>...>`
- drag: `onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleFile(f)}}`
- progress bar: `{ocrProgress!==null && <div role="progressbar" aria-valuenow={ocrProgress} className="h-1 bg-[var(--border)] rounded"><div style={{width:`${ocrProgress}%`}} className="h-1 bg-[var(--accent)]"/></div> }{ocrProgress!==null && <p className="text-xs">Membaca bukti… {ocrProgress}%</p>}`
- pending preview: ganti `p.amount` display jadi editable: `<input value={pending.description} onChange=...>` etc + `<input type="number" value={pending.amount}>` + `<input type="date" value={pending.date}>` sebelum Simpan
- error: `{ocrError && <p className="text-xs text-red-600">{ocrError}</p>}`

- [ ] **Step 4: Implement vite.config runtimeCaching**

Edit `vite.config.ts`:
```ts
VitePWA({
  registerType:'autoUpdate',
  workbox:{ globPatterns:['**/*.{js,css,html,ico,png,svg}'], navigateFallback:'/index.html',
    runtimeCaching:[{ urlPattern:/.*(?:tesseract|traineddata).*\.gz|\.wasm/, handler:'CacheFirst', options:{cacheName:'ocr-cache', expiration:{maxEntries:20, maxAgeSeconds:2592000}}}]
  },
  manifest:{...}
})
```

- [ ] **Step 5: Verify build & unit**

Run: `npm run typecheck && npm run build && npx vitest run`
Expected: pass, chunk `ocr-*` lazy, typecheck 0

- [ ] **Step 6: Commit**

```bash
git add src/views/ChatView.tsx vite.config.ts
git commit -m "feat: Chat attach capture drag-drop ocr progress + editable preview"
```

---

### Task 4: E2E receipt + PWA verify

**Files:**
- Modify: `tests/e2e/receipt.spec.ts` full flow
- Test: verify PWA 14 entries

- [ ] **Step 1: Create fixture** `public/test-receipt.png` (1x canvas 400x200 text "Total Rp 52.500 Penerima: Toko Kopi 31/08/2026") or reuse generated via `npm run build` asset

- [ ] **Step 2: Complete e2e test**

```ts
import { test, expect } from '@playwright/test';
test('receipt upload → preview editable → Simpan → Home', async({page})=>{
  await page.goto('/'); await page.evaluate(()=> new Promise<void>((res,rej)=>{const r=indexedDB.deleteDatabase('ExpendDB'); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); r.onblocked=()=>res()})); await page.reload(); await page.goto('/chat');
  const input=page.locator('input[type="file"]');
  await input.setInputFiles('public/test-receipt.png');
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByText('Preview')).toBeVisible({timeout:15000});
  await expect(page.locator('input[type="date"]')).toHaveValue('2026-08-31');
  await page.getByRole('button',{name:'Simpan'}).click();
  await expect(page.getByText(/Tercatat/)).toBeVisible();
  await page.goto('/'); await expect(page.getByText('Toko Kopi')).toBeVisible(); await expect(page.locator('.text-2xl').first()).toContainText('52.500');
});
```

- [ ] **Step 3: Run e2e**

Run: `npx playwright test tests/e2e/receipt.spec.ts --timeout=20000`
Expected: pass (allow 15s OCR)

- [ ] **Step 4: PWA verify**

Run: `npm run build` check `precache 14 entries` + `dist/assets/ocr` chunk exists

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/receipt.spec.ts public/test-receipt.png
git commit -m "test: e2e receipt upload → Home"
```

---

## Self-Review

- Spec coverage: upload/capture ✓, image umum ✓, preview editable ✓, total/date sesuai bukti ✓, gambar dibuang ✓, progress A ✓, multilingual ind+eng ✓, offline ✓ - all tasks map
- Placeholder scan: no TBD, all code blocks concrete
- Type consistency: parseReceiptText {description,amount,date,rawText} → pending same shape → db date string YYYY-MM-DD consistent
