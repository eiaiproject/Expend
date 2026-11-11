import { MAX_AMOUNT } from './export';
import { isValidISODate, todayLocalISO } from './date';
import { parseSheetsAmountCell, parseSheetsDateCell } from './sheetsImport';
import { detectKnownSource } from './sources';
import type { AiConfig } from './aiConfig';

export class AiAuthError extends Error {
  constructor() {
    super('API key ditolak');
    this.name = 'AiAuthError';
  }
}

export class AiNetworkError extends Error {
  constructor() {
    super('Endpoint tidak dapat dihubungi');
    this.name = 'AiNetworkError';
  }
}

export class AiHttpError extends Error {
  constructor(readonly status: number) {
    super(`Endpoint mengembalikan HTTP ${status}`);
    this.name = 'AiHttpError';
  }
}

export class AiModelError extends Error {
  constructor() {
    super('Model vision otomatis tidak ditemukan');
    this.name = 'AiModelError';
  }
}

export class AiResponseError extends Error {
  constructor() {
    super('Respons model tidak valid');
    this.name = 'AiResponseError';
  }
}

export interface AiModelInfo {
  id: string;
  supportsImage: boolean;
}

export interface AiParsedReceipt {
  description: string;
  amount: number;
  date: string;
  source?: string;
  note?: string;
}

type FetchLike = typeof fetch;

function authHeaders(config: AiConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };
}

async function requestJson(config: AiConfig, path: string, init: RequestInit, fetchImpl: FetchLike): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(`${config.baseUrl}${path}`, init);
  } catch {
    throw new AiNetworkError();
  }
  if (res.status === 401 || res.status === 403) throw new AiAuthError();
  if (!res.ok) throw new AiHttpError(res.status);
  try {
    return await res.json();
  } catch {
    throw new AiResponseError();
  }
}

function isImageModality(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  // OpenRouter/OpenAI-compatible providers use "image"; some use MIME types
  // such as "image/jpeg". Both mean the model accepts image input.
  return normalized === 'image' || normalized.startsWith('image/');
}

function supportsImage(model: Record<string, unknown>): boolean {
  const modalities = model.modalities as { input?: unknown } | undefined;
  const architecture = model.architecture as { input_modalities?: unknown } | undefined;
  const inputs = modalities?.input ?? model.input_modalities ?? architecture?.input_modalities;
  if (Array.isArray(inputs)) return inputs.some(isImageModality);
  if (isImageModality(inputs)) return true;
  const capabilities = model.capabilities as { vision?: unknown } | undefined;
  return capabilities?.vision === true;
}

export async function listAiModels(config: AiConfig, fetchImpl: FetchLike = fetch): Promise<AiModelInfo[]> {
  const payload = await requestJson(config, '/models', { headers: authHeaders(config) }, fetchImpl);
  const data = Array.isArray(payload) ? payload : (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new AiResponseError();
  return data
    .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
    .filter((m) => typeof m.id === 'string' && m.id.length > 0)
    .map((m) => ({ id: m.id as string, supportsImage: supportsImage(m) }));
}

export async function resolveAiModel(config: AiConfig, fetchImpl: FetchLike = fetch): Promise<string> {
  const requested = config.model.trim();
  if (requested && requested !== 'auto') return requested;
  const models = await listAiModels(config, fetchImpl);
  const vision = models.find((m) => m.supportsImage);
  if (!vision) throw new AiModelError();
  return vision.id;
}

async function chatCompletion(
  config: AiConfig,
  model: string,
  messages: unknown[],
  fetchImpl: FetchLike,
): Promise<unknown> {
  return requestJson(config, '/chat/completions', {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ model, messages, temperature: 0 }),
  }, fetchImpl);
}

function messageContent(payload: unknown): string {
  const choices = (payload as { choices?: unknown } | null)?.choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new AiResponseError();
  const message = (choices[0] as { message?: { content?: unknown } } | null)?.message;
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : (part as { text?: unknown } | null)?.text))
      .filter((part): part is string => typeof part === 'string')
      .join('');
  }
  throw new AiResponseError();
}

/**
 * Validasi payload model. Menerima JSON mentah atau objek; nominal dan tanggal
 * dinormalisasi dengan parser yang sama seperti impor spreadsheet, sehingga
 * hasil AI tidak bisa menyimpan angka di luar batas aplikasi.
 */
export function parseAiReceiptPayload(raw: unknown, today = todayLocalISO()): AiParsedReceipt {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new AiResponseError();
    try {
      value = JSON.parse(match[0]);
    } catch {
      throw new AiResponseError();
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new AiResponseError();
  const o = value as Record<string, unknown>;

  const description = typeof o.description === 'string' ? o.description.trim() : '';
  if (!description) throw new AiResponseError();

  let amount: number | null = null;
  if (typeof o.amount === 'number') amount = Math.round(o.amount);
  else if (typeof o.amount === 'string') amount = parseSheetsAmountCell(o.amount);
  if (!amount || amount <= 0 || amount > MAX_AMOUNT) throw new AiResponseError();

  let date = today;
  if (typeof o.date === 'string' && o.date.trim()) {
    const rawDate = o.date.trim();
    const parsedDate = parseSheetsDateCell(rawDate)
      ?? (/^\d{4}-\d{2}-\d{2}T/.test(rawDate) ? parseSheetsDateCell(rawDate.slice(0, 10)) : null);
    if (!parsedDate || !isValidISODate(parsedDate)) throw new AiResponseError();
    date = parsedDate;
  }

  const sourceText = typeof o.source === 'string' ? o.source.trim() : '';
  const source = sourceText ? (detectKnownSource(sourceText) ?? sourceText.slice(0, 80)) : undefined;
  const noteText = typeof o.note === 'string' ? o.note.trim() : '';
  const note = noteText ? noteText.slice(0, 200) : undefined;

  return { description: description.slice(0, 80), amount, date, source, note };
}

async function imageDataUrl(file: File): Promise<string> {
  try {
    if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
      const bitmap = await createImageBitmap(file);
      const max = 1280;
      let { width, height } = bitmap;
      const scale = Math.min(1, max / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();
        return canvas.toDataURL('image/jpeg', 0.85);
      }
      bitmap.close?.();
    }
  } catch {
    // Fallback FileReader di bawah tetap mengirim file asli bila decode gagal.
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new AiResponseError());
    reader.readAsDataURL(file);
  });
}

const RECEIPT_PROMPT = `Extract exactly one expense from this transfer/payment receipt image.
Return ONLY valid JSON with these keys:
{"description":"merchant or sender, max 80 chars","amount":12345,"date":"YYYY-MM-DD","source":"bank or wallet name if visible","note":"optional short note"}
amount must be an integer in Indonesian rupiah without separators. If the date is missing use today. Do not wrap the JSON in markdown.`;

export async function parseReceiptWithAi(
  file: File,
  config: AiConfig,
  fetchImpl: FetchLike = fetch,
): Promise<AiParsedReceipt> {
  const model = await resolveAiModel(config, fetchImpl);
  const image = await imageDataUrl(file);
  const payload = await chatCompletion(config, model, [
    { role: 'system', content: 'You are a precise receipt data extractor. Never invent amounts.' },
    {
      role: 'user',
      content: [
        { type: 'text', text: RECEIPT_PROMPT },
        { type: 'image_url', image_url: { url: image } },
      ],
    },
  ], fetchImpl);
  return parseAiReceiptPayload(messageContent(payload));
}

/**
 * Tes koneksi memakai satu request chat minimal. Ini memverifikasi key dan
 * model yang benar-benar dipakai, bukan hanya endpoint /models yang mungkin
 * tidak tersedia di semua penyedia.
 */
export async function testAiConnection(config: AiConfig, fetchImpl: FetchLike = fetch): Promise<string> {
  const model = await resolveAiModel(config, fetchImpl);
  await chatCompletion(config, model, [{ role: 'user', content: 'Reply with OK.' }], fetchImpl);
  return model;
}
