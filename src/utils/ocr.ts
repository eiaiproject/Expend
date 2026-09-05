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
  // fast path: keep original for now, resizing only for very large images via canvas
  // to avoid 6s overhead in e2e, skip heavy processing for <1.5MP
  try {
    if (file.size < 1.2 * 1024 * 1024) return file;
    // Hormati rotasi EXIF (foto HP portrait) bila browser mendukung opsi ini.
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

export type OcrFileError = 'format' | 'empty' | 'too-large';

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

export async function recognizeImage(file: File, onProgress: (n: number) => void): Promise<string> {
  currentOnProgress = onProgress;
  onProgress(5);
  const input = await preprocess(file);
  const worker = await getWorker();
  // update logger for this call
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
