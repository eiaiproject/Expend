export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const AI_CONFIG_KEY = 'expend_ai_config';
export const DEFAULT_AI_MODEL = 'auto';

/**
 * Normalisasi base URL endpoint OpenAI-compatible.
 * Hanya http(s), tanpa kredensial/query/hash. HTTP hanya diizinkan untuk
 * localhost agar API key tidak pernah dikirim polos ke jaringan.
 */
export function normalizeBaseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
  let path = url.pathname.replace(/\/+$/, '');
  path = path.replace(/\/chat\/completions$/, '');
  return `${url.origin}${path}`;
}

export function getAiConfig(): AiConfig | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const o = parsed as Record<string, unknown>;
    const baseUrl = typeof o.baseUrl === 'string' ? normalizeBaseUrl(o.baseUrl) : null;
    const apiKey = typeof o.apiKey === 'string' ? o.apiKey.trim() : '';
    const model = typeof o.model === 'string' && o.model.trim() ? o.model.trim() : DEFAULT_AI_MODEL;
    if (!baseUrl || !apiKey) return null;
    return { baseUrl, apiKey, model };
  } catch {
    return null;
  }
}

export function saveAiConfig(config: AiConfig): boolean {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const apiKey = config.apiKey.trim();
  const model = config.model.trim() || DEFAULT_AI_MODEL;
  if (!baseUrl || !apiKey) return false;
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({ baseUrl, apiKey, model }));
    return true;
  } catch {
    return false;
  }
}

export function clearAiConfig(): void {
  try {
    localStorage.removeItem(AI_CONFIG_KEY);
  } catch {
    // localStorage bisa diblokir; UI tetap mengosongkan state lokal.
  }
}

export function isAiConfigured(): boolean {
  return getAiConfig() !== null;
}
