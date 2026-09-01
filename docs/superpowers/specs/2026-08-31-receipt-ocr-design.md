# Receipt OCR - Upload Bukti Transfer → Transaksi

Date: 2026-08-31
Status: Approved (Opsi A)
Author: Expend Team

## Context
Expend 0.1.0 minimal: Home + Chat + Settings (v0.1.0 define), Dexie v2 `transactions {description,amount,date,createdAt,rawText}`, parser `parseChatInput` regex `rb/k/jt + wallet stripped`, PWA 386KiB autoUpdate, deploy Cloudflare success. User minta upload bukti transfer (bank + e-wallet, image umum) → preview editable → Simpan, gambar langsung dibuang, tetap privacy-first offline.

## Goals
- Upload/capture bukti via Chat (attach icon) + drag-drop
- OCR offline (ind+eng) progress inline A
- Parse {description,amount,date}: amount=total (termasuk admin), date dari bukti fallback today, editable di preview
- Reuse flow Simpan/Batal → db.transactions

## Non-Goals (YAGNI)
- PDF, simpan image, crop editor, cloud OCR fallback

## Approaches Evaluated
- A Offline tesseract.js@5 lazy ind+eng (Recommended): +offline privacy, -+2MB
- B Cloud OCR: +akurasi -privacy/budget
- C paddle-ocr ONNX: +ringan -maturity id

## Architecture
```
ChatView → ocr.ts (dynamic tesseract) → receiptParser.ts (pure) → pending editable → db
                ↘ Workbox runtimeCaching wasm/traineddata CacheFirst 30d
```
- ocr.ts singleton worker lazy init, terminate + revokeObjectURL after
- No new Dexie stores, reuse transactions v2
- tesseract lazy chunk, not in main bundle

## Components
### src/utils/ocr.ts
```ts
export function recognizeImage(file:File, onProgress:(n:number)=>void): Promise<string>
```
dynamic import('tesseract.js'), createWorker('ind+eng', logger), recognize, terminate

### src/utils/receiptParser.ts
```ts
export function parseReceiptText(text:string): {description:string,amount:number,date:string,rawText:string}|null
```
- amountKeywords /total|jumlah|nominal|transfer/i proximity, fallback max amount
- date: dd/mm/yyyy dd-mm-yyyy dd MMM yyyy (Jan-Des) → YYYY-MM-DD
- description: /penerima|kepada|berita|keterangan/i → titleCase 80 fallback Transfer

### src/views/ChatView.tsx
- attach button Gallery (reicon-react) + hidden file input accept image/* capture environment + drag handlers
- state ocrProgress null|0-100, ocrError, pending {description,amount,date}
- handleFile → ocr → parse → pending editable (input text/number/date) + Simpan/Batal
- error: image>5MB, wasm load fail, parse null → editable fallback

### vite.config.ts
runtimeCaching: [{urlPattern:/tesseract|traineddata/, handler:CacheFirst, cacheName:ocr-cache, expiration:{maxEntries:10, maxAgeSeconds:2592000}}]

## Data Flow
1. select/capture → File (<5MB)
2. ocrProgress=0 bar `Membaca bukti… n%` → recognize
3. text → parseReceiptText → pending → preview editable
4. edit → Simpan → db.transactions.add + chatMessages → Home live
5. revokeObjectURL, terminate

Edge: parse null → form kosong wajib isi; date miss → today; user Batal mid-OCR → terminate

## Error Handling
- wasm load fail → "Sambungkan internet sekali untuk download model"
- blur/no text → "Foto kurang jelas, isi manual"
- tie amount → max + user edit
- file type/size reject before OCR
- DB full → toast
- No cloud upload, local logging only

## Testing
- unit receiptParser.test.ts (6): total vs admin, date formats, description, fallback, null
- unit ocr.test.ts mock progress
- e2e receipt.spec.ts: setInputFiles fixture → progress → Simpan → Home total, isolate deleteDatabase
- manual BCA/GoPay screenshots

## PWA & Perf
- precache 13→14, +~2MB gzip, autoUpdate
- lazy chunk ocr-*.js
- a11y: aria-label upload bukti, progressbar aria-valuenow, keyboard editable

## Risks
- OCR accuracy 90% → mitigated editable preview
- First load weight → mitigated lazy + cache

