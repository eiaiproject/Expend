let workerPromise: Promise<any> | null = null;
/** True hanya setelah worker SELESAI dimuat - dipakai badge "Siap" di header. */
let workerReady = false;
let currentOnProgress: (n: number) => void = () => {};

/**
 * Gagal memuat worker/core/model - BUKAN "foto tidak terbaca". UI memisahkan
 * keduanya karena saran yang benar berbeda: model yang belum ada perlu diunduh
 * sekali (asetnya ~8 MB), sedangkan foto buram perlu difoto ulang.
 */
export class OcrModelError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'model OCR gagal dimuat');
    this.name = 'OcrModelError';
  }
}

/**
 * Worker + core dari origin sendiri bila `scripts/vendor-tesseract.mjs` sudah
 * jalan (prebuild). Model bahasa ikut lokal hanya kalau unduhannya berhasil;
 * kalau tidak `langPath` dibiarkan kosong agar tesseract.js memakai CDN.
 *
 * `corePath` sengaja berupa NAMA FILE (bukan direktori): dengan begitu kita yang
 * memilih varian core lewat deteksi SIMD, sehingga cukup dua varian yang perlu
 * di-vendor - browser dengan relaxed SIMD tetap memakai varian SIMD.
 */
async function ocrAssetOptions(): Promise<{ workerPath?: string; corePath?: string; langPath?: string }> {
  if (!(typeof __OCR_CORE_LOCAL__ !== 'undefined' && __OCR_CORE_LOCAL__)) return {};
  const { simd } = await import('wasm-feature-detect');
  const core = (await simd()) ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js';
  const opts: { workerPath: string; corePath: string; langPath?: string } = {
    workerPath: '/tesseract/worker.min.js',
    corePath: `/tesseract/${core}`,
  };
  if (typeof __OCR_LANG_LOCAL__ !== 'undefined' && __OCR_LANG_LOCAL__) opts.langPath = '/tesseract/lang';
  return opts;
}

async function getWorker(): Promise<any> {
  // `??=` (S6606) sekaligus jadi memo: pemuatan hanya sekali, dan reset di catch
  // di bawah membuat percobaan ulang berikutnya benar-benar memuat lagi.
  workerPromise ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    const assets = await ocrAssetOptions();
    const w: any = await createWorker('ind+eng', 1, {
      ...assets,
      logger: (m: any) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          currentOnProgress(Math.round(m.progress * 100));
        }
      },
    });
    return w;
  })();
  try {
    const w = await workerPromise;
    workerReady = true;
    return w;
  } catch (e) {
    // Model/worker gagal dimuat (mis. offline saat percobaan pertama): jangan
    // simpan promise yang sudah rejected. Sebelumnya retry apa pun gagal instan
    // sampai halaman di-reload, padahal pesan error justru menyuruh user
    // menyambung internet lalu mencoba lagi.
    workerPromise = null;
    workerReady = false;
    throw e;
  }
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

const OCR_MAX_BYTES = 10 * 1024 * 1024;
/** Format gambar yang benar-benar bisa didekode + dibaca Tesseract. */
type OcrImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Alias MIME yang sah di perangkat nyata. Android file manager kerap menulis
 * `image/jpg`/`image/pjpeg` (non-standar) untuk JPEG yang sama.
 */
const MIME_TO_TYPE: Readonly<Record<string, OcrImageType>> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

type OcrFileError = 'format' | 'empty' | 'too-large' | 'magic';

/**
 * Validasi awal file gambar bukti (murni, testable). Return null jika lolos,
 * kode error jika tidak.
 *
 * MIME kosong/tidak dikenal SENGAJA tidak ditolak di sini: provider galeri
 * Android dan share target perbankan sering mengirim file tanpa MIME yang
 * benar, sehingga menolaknya membuat upload gambar yang sah gagal. Format
 * sebenarnya ditentukan dari isi file di `validateFileMagic`.
 */
export function validateImageFile(file: { type: string; size: number }): OcrFileError | null {
  if (file.size === 0) return 'empty';
  if (file.size > OCR_MAX_BYTES) return 'too-large';
  const type = (file.type ?? '').trim().toLowerCase();
  if (!type) return null;
  // Gambar dengan format tak didukung (gif/heic/bmp) atau bukan gambar sama
  // sekali: tolak jujur di sini; sisanya diverifikasi dari magic bytes.
  if (type.startsWith('image/')) return MIME_TO_TYPE[type] ? null : 'format';
  return 'format';
}

/**
 * Deteksi format gambar dari magic bytes - BUKAN dari MIME yang dilaporkan
 * perangkat. Isi file adalah sumber kebenaran format: MIME dari galeri Android
 * dan share target perbankan bisa kosong atau salah label (mis. JPEG kecil
 * distempel image/png oleh handler share).
 */
export function detectImageType(header: Uint8Array): OcrImageType | null {
  // JPEG: SOI + marker awal (FF D8 FF)
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg';
  // PNG: signature 8 byte penuh
  if (
    header.length >= 8 &&
    header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47 &&
    header[4] === 0x0d && header[5] === 0x0a && header[6] === 0x1a && header[7] === 0x0a
  ) return 'image/png';
  // WebP: "RIFF" + 4 byte ukuran + "WEBP" (cek keempat byte agar WAV/AVI,
  // yang juga berawalan RIFF, tidak lolos).
  if (
    header.length >= 12 &&
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) return 'image/webp';
  return null;
}

/**
 * Validasi isi file gambar (async - perlu baca header).
 * Return null bila isinya benar-benar JPEG/PNG/WebP, 'magic' bila bukan.
 * A7: tetap menolak file non-gambar/polyglot, tetapi TIDAK lagi mensyaratkan
 * MIME yang dilaporkan sama dengan magic bytes - itulah yang membuat upload
 * galeri Android dan share perbankan gagal dengan "Gunakan gambar JPG...".
 */
export async function validateFileMagic(file: File): Promise<OcrFileError | null> {
  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    return detectImageType(header) ? null : 'magic';
  } catch {
    // Header tak terbaca (file hilang/stream sudah ditutup) - perlakukan
    // seperti konten tidak dikenali, bukan crash.
    return 'magic';
  }
}

interface OcrResult {
  text: string;
  /** Keyakinan 0-100 dari Tesseract; null bila worker tidak melaporkannya. */
  confidence: number | null;
}

export async function recognizeImageDetailed(file: File, onProgress: (n: number) => void): Promise<OcrResult> {
  onProgress(5);
  const input = await preprocess(file);
  let worker: any;
  try {
    worker = await getWorker();
  } catch (e) {
    throw new OcrModelError(e);
  }
  currentOnProgress = onProgress;
  const { data } = await worker.recognize(input as any);
  onProgress(100);
  const raw = typeof data?.confidence === 'number' ? data.confidence : null;
  const confidence = raw === null ? null : Math.max(0, Math.min(100, Math.round(raw)));
  return { text: (data.text ?? '') as string, confidence };
}

export async function recognizeImage(file: File, onProgress: (n: number) => void): Promise<string> {
  const r = await recognizeImageDetailed(file, onProgress);
  return r.text;
}

export function isOcrReady(): boolean {
  return workerReady;
}

async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate?.();
    workerPromise = null;
    workerReady = false;
  }
}

// Bebaskan worker saat halaman ditutup/disembunyikan permanen (pagehide).
// Navigasi antar-route tidak terminate (reuse disengaja agar OCR kedua cepat).
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', () => {
    void terminateOcr().catch(() => {});
  });
}
