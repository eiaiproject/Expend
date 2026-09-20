interface PerfEntry {
  name: string;
  ms: number;
  at: string;
}

const PERF_KEY = 'expend_perf';
const MAX_ENTRIES = 50;

export function readPerf(): PerfEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PERF_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as PerfEntry[]) : [];
  } catch {
    return [];
  }
}

export function logPerf(name: string, ms: number, at = new Date().toISOString()): void {
  try {
    localStorage.setItem(PERF_KEY, JSON.stringify([...readPerf(), { name, ms, at }].slice(-MAX_ENTRIES)));
  } catch {}
}
