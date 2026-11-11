import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AI_CONFIG_KEY,
  clearAiConfig,
  getAiConfig,
  normalizeBaseUrl,
  saveAiConfig,
} from '../../src/utils/aiConfig';
import {
  AiAuthError,
  listAiModels,
  parseAiReceiptPayload,
  parseReceiptWithAi,
  resolveAiModel,
  testAiConnection,
} from '../../src/utils/ai';

const CONFIG = { baseUrl: 'https://api.example.com/v1', apiKey: 'secret-key', model: 'auto' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const MODELS = {
  data: [
    { id: 'text-only', modalities: { input: ['text'] } },
    { id: 'vision-model', modalities: { input: ['text', 'image/jpeg'] } },
  ],
};

beforeEach(() => {
  localStorage.clear();
});

describe('normalizeBaseUrl', () => {
  it('menerima HTTPS dan localhost HTTP, menolak HTTP publik/kredensial/query', () => {
    expect(normalizeBaseUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1');
    expect(normalizeBaseUrl('https://api.example.com/v1/chat/completions')).toBe('https://api.example.com/v1');
    expect(normalizeBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
    expect(normalizeBaseUrl('http://api.example.com/v1')).toBeNull();
    expect(normalizeBaseUrl('https://user:pass@api.example.com/v1')).toBeNull();
    expect(normalizeBaseUrl('https://api.example.com/v1?x=1')).toBeNull();
    expect(normalizeBaseUrl('bukan-url')).toBeNull();
  });
});

describe('konfigurasi BYOK', () => {
  it('menyimpan, membaca, dan menghapus konfigurasi lokal', () => {
    expect(saveAiConfig(CONFIG)).toBe(true);
    expect(getAiConfig()).toEqual(CONFIG);
    expect(localStorage.getItem(AI_CONFIG_KEY)).toContain('secret-key');
    clearAiConfig();
    expect(getAiConfig()).toBeNull();
  });

  it('menolak konfigurasi tanpa key atau base URL tidak aman', () => {
    expect(saveAiConfig({ ...CONFIG, apiKey: '' })).toBe(false);
    expect(saveAiConfig({ ...CONFIG, baseUrl: 'http://example.com/v1' })).toBe(false);
  });
});

describe('model vision otomatis', () => {
  it('memilih model yang mendukung input gambar dari metadata /models', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(MODELS));
    const models = await listAiModels(CONFIG, fetchMock as unknown as typeof fetch);
    expect(models).toEqual([
      { id: 'text-only', supportsImage: false },
      { id: 'vision-model', supportsImage: true },
    ]);
    await expect(resolveAiModel(CONFIG, fetchMock as unknown as typeof fetch)).resolves.toBe('vision-model');
  });

  it('mengenali modalitas "image" polos dari provider OpenAI-compatible', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      data: [
        { id: 'openrouter-vision', architecture: { input_modalities: ['text', 'image'] } },
        { id: 'bare-vision', modalities: { input: ['image'] } },
      ],
    }));
    const models = await listAiModels(CONFIG, fetchMock as unknown as typeof fetch);
    expect(models).toEqual([
      { id: 'openrouter-vision', supportsImage: true },
      { id: 'bare-vision', supportsImage: true },
    ]);
  });

  it('model eksplisit tidak memanggil /models', async () => {
    const fetchMock = vi.fn();
    await expect(resolveAiModel({ ...CONFIG, model: 'my-vision' }, fetchMock as unknown as typeof fetch)).resolves.toBe('my-vision');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gagal jelas bila tidak ada model vision', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [{ id: 'text-only', modalities: { input: ['text'] } }] }));
    await expect(resolveAiModel(CONFIG, fetchMock as unknown as typeof fetch)).rejects.toMatchObject({ name: 'AiModelError' });
  });
});

describe('parseAiReceiptPayload', () => {
  it('menerima JSON fenced, nominal string Rupiah, dan tanggal ISO', () => {
    const parsed = parseAiReceiptPayload('```json\n{"description":"Kopi","amount":"Rp 25.000","date":"2026-09-15","source":"BSI","note":"rapat"}\n```');
    expect(parsed).toMatchObject({
      description: 'Kopi',
      amount: 25000,
      date: '2026-09-15',
      source: 'BSI',
      note: 'rapat',
    });
  });

  it('memakai tanggal hari ini bila kosong, menolak nominal/tanggal tidak valid', () => {
    expect(parseAiReceiptPayload({ description: 'Kopi', amount: 25000, date: '' }, '2026-11-11').date).toBe('2026-11-11');
    expect(() => parseAiReceiptPayload({ description: 'Kopi', amount: 0 })).toThrow();
    expect(() => parseAiReceiptPayload({ description: 'Kopi', amount: 25000, date: '2026-13-01' })).toThrow();
    expect(() => parseAiReceiptPayload({ amount: 25000 })).toThrow();
  });
});

describe('pemanggilan AI', () => {
  it('mengirim gambar dan memvalidasi respons chat', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/models')) return jsonResponse(MODELS);
      return jsonResponse({ choices: [{ message: { content: '{"description":"Transfer","amount":50000,"date":"2026-09-15"}' } }] });
    });
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'bukti.jpg', { type: 'image/jpeg' });
    const parsed = await parseReceiptWithAi(file, CONFIG, fetchMock as unknown as typeof fetch);
    expect(parsed).toMatchObject({ description: 'Transfer', amount: 50000, date: '2026-09-15' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tes koneksi mengembalikan model yang dipakai dan memetakan 401 ke AiAuthError', async () => {
    const okFetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/models')) return jsonResponse(MODELS);
      return jsonResponse({ choices: [{ message: { content: 'OK' } }] });
    });
    await expect(testAiConnection(CONFIG, okFetch as unknown as typeof fetch)).resolves.toBe('vision-model');

    const authFetch = vi.fn(async () => jsonResponse({ error: 'Unauthorized' }, 401));
    await expect(testAiConnection(CONFIG, authFetch as unknown as typeof fetch)).rejects.toBeInstanceOf(AiAuthError);
  });
});
