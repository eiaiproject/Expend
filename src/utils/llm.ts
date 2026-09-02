import type { ParsedExpense } from './chatParser';
import { titleCasePreserveAcronyms } from './textFormat';

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
  // Handle ```json ... ``` wrapper
  const m = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed); // NOSONAR
  if (m?.[1]) return m[1].trim();
  // Find first { ... } block
  const s = trimmed.indexOf('{');
  const e = trimmed.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) return trimmed.slice(s, e + 1);
  return trimmed;
}

export async function parseWithLLM(text: string): Promise<ParsedExpense | null> {
  const cfg = getLLMConfig();
  if (!cfg.enabled || !cfg.apiKey.trim() || !cfg.model.trim()) return null;

  const base = normalizeBaseUrl(cfg.baseUrl);
  // Support both /v1 and without
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildPrompt(text, today);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Expend',
      },
      body: JSON.stringify({
        model: cfg.model.trim(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`LLM ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const jsonStr = extractJson(content);
    const parsed = JSON.parse(jsonStr) as {
      description?: string;
      amount?: number;
      source?: string | null;
      date?: string | null;
    };

    const amount = typeof parsed.amount === 'number' ? parsed.amount : Number(parsed.amount);
    if (!amount || amount <= 0) return null;

    let description = (parsed.description || 'Pengeluaran').trim();
    if (!description) description = 'Pengeluaran';
    description = titleCasePreserveAcronyms(description).slice(0, 80);

    let source: string | undefined;
    if (parsed.source && typeof parsed.source === 'string' && parsed.source.trim()) {
      source = titleCasePreserveAcronyms(parsed.source.trim());
    }

    let date: string | undefined;
    if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      date = parsed.date;
    } else {
      date = today;
    }

    return { description, amount, source, date };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testLLMConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = getLLMConfig();
  if (!cfg.enabled) return { ok: false, message: 'Aktifkan dulu parsing pintar.' };
  if (!cfg.apiKey.trim()) return { ok: false, message: 'API key kosong.' };
  if (!cfg.model.trim()) return { ok: false, message: 'Model kosong.' };

  const r = await parseWithLLM('kopi 25rb'); // NOSONAR
  if (r && r.amount === 25000) return { ok: true, message: `OK — ${r.description} Rp${r.amount}` };
  if (r) return { ok: true, message: `Terhubung — ${r.description}` };
  return { ok: false, message: 'Gagal parse. Periksa base URL / key / model.' };
}
