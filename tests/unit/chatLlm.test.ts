import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage before importing module
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  },
  configurable: true,
});

Object.defineProperty(window, 'location', {
  value: { origin: 'http://localhost:3000' },
  configurable: true,
});

import { isChatQuestion, parseChatWithLLM, isLLMEnabled, getLLMConfig, saveLLMConfig } from '../../src/utils/llm';

// ─── isChatQuestion ──────────────────────────────────────────────────────────

describe('isChatQuestion', () => {
  it('returns true for text ending with ?', () => {
    expect(isChatQuestion('berapa total minggu ini?')).toBe(true);
    expect(isChatQuestion('kopi 20rb?')).toBe(true);
  });

  it('returns true for text with Indonesian question words', () => {
    expect(isChatQuestion('apa itu expend')).toBe(true);
    expect(isChatQuestion('bagaimana cara backup')).toBe(true);
    expect(isChatQuestion('kapan terakhir sync')).toBe(true);
    expect(isChatQuestion('dimana simpan data')).toBe(true);
    expect(isChatQuestion('siapa developer')).toBe(true);
    expect(isChatQuestion('mengapa error')).toBe(true);
    expect(isChatQuestion('kenapa lambat')).toBe(true);
    expect(isChatQuestion('apakah data aman')).toBe(true);
    expect(isChatQuestion('gimana caranya')).toBe(true);
  });

  it('returns false for plain expense input', () => {
    expect(isChatQuestion('kopi 20rb')).toBe(false);
    expect(isChatQuestion('beli indomaret 50000 bca')).toBe(false);
    expect(isChatQuestion('makan siang 25rb dari gopay')).toBe(false);
  });

  it('returns false for empty or whitespace', () => {
    expect(isChatQuestion('')).toBe(false);
    expect(isChatQuestion('   ')).toBe(false);
  });

  it('is case-insensitive for question words', () => {
    expect(isChatQuestion('APA itu')).toBe(true);
    expect(isChatQuestion('Berapa total')).toBe(true);
  });
});

// ─── parseChatWithLLM (mocked fetch) ─────────────────────────────────────────

describe('parseChatWithLLM', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store.clear();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when LLM is not enabled', async () => {
    saveLLMConfig({ enabled: false, baseUrl: 'https://x', apiKey: 'k', model: 'm' });
    const result = await parseChatWithLLM('halo?');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns assistant text on successful response', async () => {
    saveLLMConfig({ enabled: true, baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-test', model: 'openai/gpt-4o-mini' });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '  Halo! Saya asisten Expend.  ' } }] }),
    });
    const result = await parseChatWithLLM('halo?');
    expect(result).toBe('Halo! Saya asisten Expend.');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('returns null when fetch returns non-ok', async () => {
    saveLLMConfig({ enabled: true, baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-test', model: 'openai/gpt-4o-mini' });
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    const result = await parseChatWithLLM('berapa?');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    saveLLMConfig({ enabled: true, baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-test', model: 'openai/gpt-4o-mini' });
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    const result = await parseChatWithLLM('apa?');
    expect(result).toBeNull();
  });

  it('returns null when response has no content', async () => {
    saveLLMConfig({ enabled: true, baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-test', model: 'openai/gpt-4o-mini' });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    });
    const result = await parseChatWithLLM('test?');
    expect(result).toBeNull();
  });

  it('sends auth header with api key', async () => {
    saveLLMConfig({ enabled: true, baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-abc123', model: 'm' });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await parseChatWithLLM('halo?');
    const [, init] = fetchSpy.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toContain('sk-abc123');
  });

  it('includes history in prompt', async () => {
    saveLLMConfig({ enabled: true, baseUrl: 'https://x', apiKey: 'k', model: 'm' });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'balasan' } }] }),
    });
    await parseChatWithLLM('lagi?', [
      { role: 'user', text: 'apa itu expend' },
      { role: 'assistant', text: 'aplikasi pencatat' },
    ]);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    const content = body.messages[0].content;
    expect(content).toContain('User: apa itu expend');
    expect(content).toContain('Assistant: aplikasi pencatat');
    expect(content).toContain('User: lagi?');
  });
});

// ─── isLLMEnabled ────────────────────────────────────────────────────────────

describe('isLLMEnabled', () => {
  beforeEach(() => { store.clear(); });

  it('returns false when disabled', () => {
    saveLLMConfig({ enabled: false, baseUrl: 'x', apiKey: 'k', model: 'm' });
    expect(isLLMEnabled()).toBe(false);
  });

  it('returns false when api key empty', () => {
    saveLLMConfig({ enabled: true, baseUrl: 'x', apiKey: '   ', model: 'm' });
    expect(isLLMEnabled()).toBe(false);
  });

  it('returns true when all configured', () => {
    saveLLMConfig({ enabled: true, baseUrl: 'x', apiKey: 'k', model: 'm' });
    expect(isLLMEnabled()).toBe(true);
  });
});

describe('getLLMConfig', () => {
  it('returns defaults when no config saved', () => {
    store.clear();
    const cfg = getLLMConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.baseUrl).toBe('https://openrouter.ai/api/v1');
  });
});
