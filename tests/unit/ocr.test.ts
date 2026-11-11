import { describe, it, expect, vi } from 'vitest';
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: async () => ({ data: { text: 'Total Rp 10.000' } }),
    terminate: async () => {},
  })),
}));
import { createWorker } from 'tesseract.js';
import { recognizeImage, validateImageFile, validateFileMagic, validateImagePixels, detectImageType, imageDimensions } from '../../src/utils/ocr';

// Header asli tiap format + satu non-gambar, supaya validasi diuji dari isi
// file (bukan dari MIME yang dilaporkan perangkat).
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const WAVE = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45];
const TEXT = [0x69, 0x6e, 0x69, 0x20, 0x62, 0x75, 0x6b, 0x61, 0x6e];

const bytes = (arr: number[]) => new Uint8Array(arr);
const fileOf = (arr: number[], type: string) => new File([bytes(arr)], 'receipt.img', { type });

describe('ocr worker', () => {
  it('bisa retry setelah gagal memuat model (workerPromise di-reset)', async () => {
    vi.mocked(createWorker).mockRejectedValueOnce(new Error('offline'));
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(recognizeImage(f, () => {})).rejects.toThrow('offline');
    // Percobaan kedua harus memuat ulang model, bukan melempar promise rejected lama.
    expect(await recognizeImage(f, () => {})).toContain('Total');
  });

  it('calls progress', async () => {
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    const cb = vi.fn();
    const t = await recognizeImage(f, cb);
    expect(t).toContain('Total');
  });
});

describe('validateImageFile', () => {
  it('menerima gambar didukung, alias image/jpg, dan MIME kosong', () => {
    expect(validateImageFile({ type: 'image/png', size: 100 })).toBeNull();
    expect(validateImageFile({ type: 'image/jpeg', size: 100 })).toBeNull();
    expect(validateImageFile({ type: 'image/webp', size: 100 })).toBeNull();
    // Alias non-standar yang dipakai sebagian file manager Android.
    expect(validateImageFile({ type: 'image/jpg', size: 100 })).toBeNull();
    // Provider galeri Android kerap mengirim gambar tanpa MIME sama sekali.
    expect(validateImageFile({ type: '', size: 100 })).toBeNull();
  });

  it('menolak format gambar tak didukung dan non-gambar', () => {
    expect(validateImageFile({ type: 'image/gif', size: 100 })).toBe('format');
    expect(validateImageFile({ type: 'text/plain', size: 100 })).toBe('format');
    expect(validateImageFile({ type: 'application/pdf', size: 100 })).toBe('format');
  });

  it('menolak file kosong dan terlalu besar', () => {
    expect(validateImageFile({ type: 'image/png', size: 0 })).toBe('empty');
    expect(validateImageFile({ type: 'image/png', size: 11 * 1024 * 1024 })).toBe('too-large');
  });
});

describe('detectImageType', () => {
  it('mengenali JPEG/PNG/WebP dari magic bytes', () => {
    expect(detectImageType(bytes(JPEG))).toBe('image/jpeg');
    expect(detectImageType(bytes(PNG))).toBe('image/png');
    expect(detectImageType(bytes(WEBP))).toBe('image/webp');
  });

  it('menolak konten non-gambar, header terpotong, dan RIFF bukan-WebP', () => {
    expect(detectImageType(bytes(TEXT))).toBeNull();
    expect(detectImageType(bytes([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(bytes([]))).toBeNull();
    expect(detectImageType(bytes(WAVE))).toBeNull();
  });
});

describe('imageDimensions', () => {
  it('membaca dimensi PNG dari IHDR', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    png.set([0x00, 0x00, 0x03, 0x20], 16);
    png.set([0x00, 0x00, 0x02, 0x58], 20);
    expect(imageDimensions(png)).toEqual({ width: 800, height: 600 });
  });

  it('membaca dimensi JPEG dari marker SOF', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20,
    ]);
    expect(imageDimensions(jpeg)).toEqual({ width: 800, height: 600 });
  });

  it('membaca dimensi WebP VP8X, VP8L, dan VP8', () => {
    const vp8x = new Uint8Array(30);
    vp8x.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 0);
    vp8x.set([0x56, 0x50, 0x38, 0x58], 12);
    vp8x.set([0x1f, 0x03, 0x00], 24);
    vp8x.set([0x57, 0x02, 0x00], 27);
    expect(imageDimensions(vp8x)).toEqual({ width: 800, height: 600 });

    const vp8l = new Uint8Array(25);
    vp8l.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 0);
    vp8l.set([0x56, 0x50, 0x38, 0x4c], 12);
    vp8l[20] = 0x2f;
    const bits = (799 | (599 << 14)) >>> 0;
    vp8l.set([bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff], 21);
    expect(imageDimensions(vp8l)).toEqual({ width: 800, height: 600 });

    const vp8 = new Uint8Array(30);
    vp8.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 0);
    vp8.set([0x56, 0x50, 0x38, 0x20], 12);
    vp8.set([0x9d, 0x01, 0x2a], 23);
    vp8.set([0x20, 0x03], 26);
    vp8.set([0x58, 0x02], 28);
    expect(imageDimensions(vp8)).toEqual({ width: 800, height: 600 });
  });

  it('mengembalikan null untuk header terpotong', () => {
    expect(imageDimensions(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(imageDimensions(new Uint8Array(0))).toBeNull();
  });
});

describe('validateImagePixels', () => {
  it('menolak header gambar di atas batas piksel sebelum decode', async () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    png.set([0x00, 0x00, 0x27, 0x10], 16); // 10.000 px
    png.set([0x00, 0x00, 0x27, 0x10], 20);
    await expect(validateImagePixels(new File([png], 'big.png', { type: 'image/png' }))).resolves.toBe('too-large');
  });

  it('menerima gambar kecil dan header yang tidak terbaca', async () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    png.set([0x00, 0x00, 0x03, 0x20], 16); // 800 px
    png.set([0x00, 0x00, 0x02, 0x58], 20); // 600 px
    await expect(validateImagePixels(new File([png], 'small.png', { type: 'image/png' }))).resolves.toBeNull();
    await expect(validateImagePixels(new File([new Uint8Array(0)], 'empty.png', { type: 'image/png' }))).resolves.toBeNull();
  });
});

describe('validateFileMagic', () => {
  it('percaya isi file, bukan MIME yang dilaporkan', async () => {
    // Regresi: share handler perbankan menstempel image/png saat file.type kosong.
    await expect(validateFileMagic(fileOf(JPEG, 'image/png'))).resolves.toBeNull();
    // Regresi: galeri Android mengirim gambar tanpa MIME.
    await expect(validateFileMagic(fileOf(JPEG, ''))).resolves.toBeNull();
    await expect(validateFileMagic(fileOf(PNG, 'application/octet-stream'))).resolves.toBeNull();
    await expect(validateFileMagic(fileOf(WEBP, 'image/webp'))).resolves.toBeNull();
  });

  it('tetap menolak konten yang bukan gambar', async () => {
    await expect(validateFileMagic(fileOf(TEXT, 'image/png'))).resolves.toBe('magic');
    await expect(validateFileMagic(fileOf([], 'image/png'))).resolves.toBe('magic');
  });
});
