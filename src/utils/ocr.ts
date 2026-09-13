let workerPromise: Promise<any> | null = null;
let currentOnProgress: (n: number) => void = () => {};

async function getWorker(): Promise<any> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const { createWorker } = await import('tesseract.js');
    const w: any = await createWorker('ind+eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          currentOnProgress(Math.round(m.progress * 100));
        }
      },
    });
    return w;
  })();
  return workerPromise;
}

async function preprocess(file: File): Promise<Blob | File> {
  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      bitmap = await createImageBitmap(file);
    }
    const max = 1000;
    let { width, height } = bitmap;
    if (width <= max && height <= max) {
      bitmap.close?.();
      return file;
    }
    const scale = Math.min(max / width, max / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b as Blob), 'image/jpeg', 0.85) as any);
    return blob ?? file;
  } catch {
    return file;
  }
}

export const OCR_MAX_BYTES = 10 * 1024 * 1024;
export const OCR_ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type OcrFileError = 'format' | 'empty' | 'too-large' | 'magic';

/**
 * Validasi file gambar bukti secara murni (testable).
 * Return null jika valid, kode error jika tidak.
 * Memeriksa MIME, ekstensi implisit via type, ukuran, dan file kosong.
 */
export function validateImageFile(file: { type: string; size: number }): OcrFileError | null {
  if (!file.type.startsWith('image/') || !(OCR_ALLOWED as readonly string[]).includes(file.type)) return 'format';
  if (file.size === 0) return 'empty';
  if (file.size > OCR_MAX_BYTES) return 'too-large';
  return null;
}

// A7: Magic number signatures untuk validasi file upload.
// Mencegah polyglot file (gambar + script) yang lolos hanya berdasarkan MIME type.
const MAGIC_SIGNATURES: ReadonlyArray<{ magic: number[]; mime: string }> = [
  { magic: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { magic: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { magic: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }, // RIFF header (WebP starts with RIFF)
];

/**
 * Validasi magic number file gambar (async - perlu baca header).
 * Return null jika valid, 'magic' jika magic number tidak cocok dengan MIME type.
 * A7: Mencegah polyglot file yang lolos hanya berdasarkan extension/MIME.
 */
export async function validateFileMagic(file: File): Promise<OcrFileError | null> {
  // Baca 16 byte pertama untuk identifikasi magic number
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sig = MAGIC_SIGNATURES.find((s) => header.slice(0, s.magic.length).every((b, i) => b === s.magic[i]));
  if (!sig) return 'magic';
  // Pastikan magic number cocok dengan declared MIME type
  if (sig.mime !== file.type) return 'magic';
  return null;
}

export async function recognizeImage(file: File, onProgress: (n: number) => void): Promise<string> {
  onProgress(5);
  const input = await preprocess(file);
  const worker = await getWorker();
  currentOnProgress = onProgress;
  const { data } = await worker.recognize(input as any);
  onProgress(100);
  return data.text as string;
}

export function isOcrReady(): boolean {
  return workerPromise !== null;
}

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate?.();
    workerPromise = null;
  }
}

// Bebaskan worker saat halaman ditutup/disembunyikan permanen (pagehide).
// Navigasi antar-route tidak terminate (reuse disengaja agar OCR kedua cepat).
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', () => {
    void terminateOcr().catch(() => {});
  });
}
