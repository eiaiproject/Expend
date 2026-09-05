import { describe, it, expect, vi } from 'vitest';
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: async () => ({ data: { text: 'Total Rp 10.000' } }),
    terminate: async () => {},
  })),
}));
import { recognizeImage, validateImageFile } from '../../src/utils/ocr';

describe('ocr', () => {
  it('calls progress', async () => {
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    const cb = vi.fn();
    const t = await recognizeImage(f, cb);
    expect(t).toContain('Total');
  });
  it('validateImageFile rejects format/empty/oversize', () => {
    expect(validateImageFile({ type: 'image/png', size: 100 })).toBeNull();
    expect(validateImageFile({ type: 'image/jpeg', size: 100 })).toBeNull();
    expect(validateImageFile({ type: 'image/webp', size: 100 })).toBeNull();
    expect(validateImageFile({ type: 'image/gif', size: 100 })).toBe('format');
    expect(validateImageFile({ type: 'text/plain', size: 100 })).toBe('format');
    expect(validateImageFile({ type: 'image/png', size: 0 })).toBe('empty');
    expect(validateImageFile({ type: 'image/png', size: 11 * 1024 * 1024 })).toBe('too-large');
  });
});
