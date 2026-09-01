import { describe, it, expect, vi } from 'vitest';
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: async () => ({ data: { text: 'Total Rp 10.000' } }),
    terminate: async () => {},
  })),
}));
import { recognizeImage } from '../../src/utils/ocr';

describe('ocr', () => {
  it('calls progress', async () => {
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    const cb = vi.fn();
    const t = await recognizeImage(f, cb);
    expect(t).toContain('Total');
  });
});
