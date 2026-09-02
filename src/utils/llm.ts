import type { ParsedExpense } from './chatParser';
import { titleCasePreserveAcronyms } from './textFormat';
import { t } from '../i18n/standalone';

export interface LLMConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = 'expend_llm_config';

const DEFAULT_CONFIG: LLMConfig = {
  enabled: false,
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'openai/gpt-4o-mini',
};

export function getLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<LLMConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveLLMConfig(cfg: LLMConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function isLLMEnabled(): boolean {
  const c = getLLMConfig();
  return c.enabled && !!c.apiKey.trim() && !!c.model.trim();
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, ''); // NOSONAR
}

function getLLMUrl(): string | null {
  const cfg = getLLMConfig();
  if (!cfg.apiKey.trim() || !cfg.model.trim()) return null;
  const base = normalizeBaseUrl(cfg.baseUrl);
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

function buildPrompt(text: string, today: string): string {
  return `Kamu parser pengeluaran Indonesia. Ekstrak dari teks berikut.

Aturan:
- amount: angka Rupiah. 50rb/1jt/2 juta/500k/15.000/15,50 → number. Jika tidak ada, 0.
- description: Title Case, tanpa verb beli/bayar/jajan/belanja/order/pesan, tanpa sumber. Fallback "Pengeluaran" jika kosong. Maks 80 karakter.
- source: nama bank/wallet (BCA, BSI, GoPay, OVO, Dana, Tunai, Kas, dll) atau null jika tidak ada.
- date: YYYY-MM-DD. Hari ini=${today}. "kemarin"=${new Date(new Date(today).getTime() - 86400000).toISOString().slice(0, 10)}, "lusa"=${new Date(new Date(today).getTime() + 2 * 86400000).toISOString().slice(0, 10)}, "hari ini"=${today}. Jika "tgl 15", tahun-bulan=${today.slice(0, 7)}-15. Jika format 15/08/2026 atau 15 Agustus 2026, parse. Jika tidak ada, null.

Hanya kembalikan JSON valid tanpa markdown:
{"description": string, "amount": number, "source": string|null, "date": string|null}

Teks: "${text.replaceAll('"', '\\"')}"`; // NOSONAR
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const m = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed); // NOSONAR
  if (m?.[1]) return m[1].trim();
  const s = trimmed.indexOf('{');
  const e = trimmed.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) return trimmed.slice(s, e + 1);
  return trimmed;
}

function stripAmountFromDesc(desc: string): string {
  return desc.replace(/\s*\d[\d.,]*\s*(?:rb|ribu|jt|juta|k)?\s*$/i, '').trim() || desc; // NOSONAR
}

function isVisionModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes('vision') || m.includes('gpt-4o') || m.includes('claude-3') || m.includes('gemini') || m.includes('qwen-vl') || m.includes('llava');
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error('Gagal baca file'));
    reader.readAsDataURL(file);
  });
}

function buildReceiptPrompt(ocrText: string, today: string): string {
  return `Kamu parser struk transfer Indonesia. Teks ini hasil OCR, mungkin ada typo (mandlri->mandiri, Penerlma->Penerima, Tota1->Total, Berhas1l->Berhasil, Seabank->SeaBank).

Ekstrak JSON valid tanpa markdown:
{"description": string, "amount": number, "source": string|null, "date": string|null, "note": string|null}

Aturan:
- amount: angka terbesar yang masuk akal sebagai nominal transaksi (abaikan no ref/rekening/tgl). 14.500=14500, 1.500.000=1500000.
- description: nama penerima/merchant (tanpa "Penerima:", tanpa no rekening). Title Case, maksimal 80 karakter. Fallback "Transfer".
- source: bank/wallet pengirim (Mandiri, BCA, BRI, BNI, SeaBank, GoPay, dll) atau null.
- date: YYYY-MM-DD, hari ini=${today}. Parse 11 Agu 2026 atau 11/08/2026. Jika tidak ada, ${today}.
- note: "Pulang/ Pergi + tujuan" jika ada, atau null.

Teks OCR:\n"""${ocrText.slice(0, 2000).replaceAll('"', '\\"')}"""`; // NOSONAR
}

async function callLLM(messages: unknown[], maxTokens: number, timeoutMs: number): Promise<string | null> {
  const cfg = getLLMConfig();
  const url = getLLMUrl();
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Expend',
      },
      body: JSON.stringify({ model: cfg.model.trim(), messages, temperature: 0, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // NOSONAR

function normalizeExpense(
  parsed: Record<string, unknown>,
  today: string,
  defaultDesc: string,
): { description: string; amount: number; source?: string; date: string; note?: string } | null {
  const amount = typeof parsed.amount === 'number' ? parsed.amount : Number(parsed.amount);
  if (!amount || amount <= 0) return null;
  let description = ((parsed.description as string) || defaultDesc).trim() || defaultDesc;
  description = stripAmountFromDesc(description);
  if (!description) description = defaultDesc;
  description = titleCasePreserveAcronyms(description).slice(0, 80);
  let source: string | undefined;
  if (parsed.source && typeof parsed.source === 'string' && (parsed.source as string).trim()) {
    source = titleCasePreserveAcronyms((parsed.source as string).trim());
  }
  const date = (parsed.date && DATE_RE.test(parsed.date as string)) ? parsed.date as string : today; // NOSONAR
  let note: string | undefined;
  if (parsed.note && typeof parsed.note === 'string' && (parsed.note as string).trim()) {
    note = (parsed.note as string).trim().slice(0, 80);
  }
  return { description, amount, source, date, note };
}

async function parseLLMResponse(
  messages: unknown[],
  maxTokens: number,
  timeoutMs: number,
  defaultDesc: string,
): Promise<{ description: string; amount: number; source?: string; date: string; note?: string } | null> {
  if (!isLLMEnabled()) return null;
  const today = new Date().toISOString().slice(0, 10);
  const content = await callLLM(messages, maxTokens, timeoutMs);
  if (!content) return null;
  try {
    const parsed = JSON.parse(extractJson(content)) as Record<string, unknown>;
    return normalizeExpense(parsed, today, defaultDesc);
  } catch {
    return null;
  }
}

export async function parseReceiptWithLLM(ocrText: string): Promise<(ParsedExpense & { note?: string }) | null> {
  const today = new Date().toISOString().slice(0, 10);
  return parseLLMResponse([{ role: 'user', content: buildReceiptPrompt(ocrText, today) }], 500, 20_000, 'Transfer') as Promise<(ParsedExpense & { note?: string }) | null>;
}

export async function parseReceiptImageWithLLM(file: File): Promise<(ParsedExpense & { note?: string }) | null> {
  const cfg = getLLMConfig();
  if (!isVisionModel(cfg.model)) return null;
  const today = new Date().toISOString().slice(0, 10);
  const b64 = await fileToBase64(file);
  const mime = file.type || 'image/jpeg';
  return parseLLMResponse(
    [{
      role: 'user',
      content: [
        { type: 'text', text: buildReceiptPrompt('Lihat gambar struk ini.', today) },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
      ],
    }],
    500,
    30_000,
    'Transfer',
  ) as Promise<(ParsedExpense & { note?: string }) | null>;
}

export async function parseWithLLM(text: string): Promise<ParsedExpense | null> {
  const today = new Date().toISOString().slice(0, 10);
  return parseLLMResponse([{ role: 'user', content: buildPrompt(text, today) }], 300, 15_000, 'Pengeluaran');
}

export async function testLLMConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = getLLMConfig();
  if (!cfg.enabled) return { ok: false, message: t('llm.activateFirst') };
  if (!cfg.apiKey.trim()) return { ok: false, message: t('llm.apiKeyEmpty') };
  if (!cfg.model.trim()) return { ok: false, message: t('llm.modelEmpty') };
  const r = await parseWithLLM('kopi 25rb'); // NOSONAR
  if (r && r.amount === 25000) return { ok: true, message: t('llm.testSuccess', { desc: r.description, amount: r.amount }) };
  if (r) return { ok: true, message: t('llm.testConnected', { desc: r.description, amount: r.amount }) };
  return { ok: false, message: t('llm.testFailed') };
}
