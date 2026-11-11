let workerPromise: Promise<any> | null = null;
/** True hanya setelah worker SELESAI dimuat - dipakai badge "Siap" di header. */
let workerReady = false;
let currentOnProgress: (n: number) => void = () => {};
let progressToken = 0;

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

/** Gambar valid tetapi ukurannya melampaui anggaran decode memori. */
export class OcrImageTooLargeError extends Error {
  constructor() {
    super('gambar terlalu besar untuk diproses');
    this.name = 'OcrImageTooLargeError';
  }
}

/** Batas 40 MP: cukup untuk foto ponsel, jauh di bawah batas yang membuat tab OOM. */
export const MAX_IMAGE_PIXELS = 40_000_000;

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
    const dimensions = await imageDimensionsFromFile(file);
    if (dimensions && dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
      throw new OcrImageTooLargeError();
    }
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
  } catch (e) {
    // Batas piksel adalah penolakan yang disengaja; jangan ditelan fallback
    // yang mengembalikan file asli dan kemudian memicu OOM di createImageBitmap.
    if (e instanceof OcrImageTooLargeError) throw e;
    return file;
  }
}

async function imageDimensionsFromFile(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const header = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
    return imageDimensions(header);
  } catch {
    return null;
  }
}

/**
 * Tolak gambar yang akan memakan memori terlalu besar sebelum ada jalur
 * (OCR atau AI) yang men-decode gambar penuh. Header saja yang dibaca.
 * Null berarti dimensi tidak terbaca; pemanggil boleh lanjut.
 */
export async function validateImagePixels(file: File): Promise<'too-large' | null> {
  const dimensions = await imageDimensionsFromFile(file);
  return dimensions && dimensions.width * dimensions.height > MAX_IMAGE_PIXELS ? 'too-large' : null;
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

type Dimensions = { width: number; height: number };

function pngDimensions(header: Uint8Array): Dimensions | null {
  if (header.length < 24 || header[0] !== 0x89 || header[1] !== 0x50 || header[2] !== 0x4e || header[3] !== 0x47) {
    return null;
  }
  const width = ((header[16]! << 24) | (header[17]! << 16) | (header[18]! << 8) | header[19]!) >>> 0;
  const height = ((header[20]! << 24) | (header[21]! << 16) | (header[22]! << 8) | header[23]!) >>> 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

function isJpegSofMarker(marker: number): boolean {
  return (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf);
}

function isJpegStandaloneMarker(marker: number): boolean {
  return marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function jpegDimensions(header: Uint8Array): Dimensions | null {
  if (header.length < 4 || header[0] !== 0xff || header[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= header.length) {
    if (header[i] !== 0xff) { i++; continue; }
    const marker = header[i + 1]!;
    if (isJpegStandaloneMarker(marker)) {
      i += 2;
      continue;
    }
    const len = (header[i + 2]! << 8) | header[i + 3]!;
    if (len < 2) break;
    if (isJpegSofMarker(marker) && i + 9 <= header.length) {
      const height = (header[i + 5]! << 8) | header[i + 6]!;
      const width = (header[i + 7]! << 8) | header[i + 8]!;
      if (width > 0 && height > 0) return { width, height };
    }
    i += 2 + len;
  }
  return null;
}

function isWebpHeader(header: Uint8Array): boolean {
  return header.length >= 12 &&
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
}

function webpDimensions(header: Uint8Array): Dimensions | null {
  if (header.length < 24 || !isWebpHeader(header)) return null;
  const chunk = String.fromCodePoint(header[12]!, header[13]!, header[14]!, header[15]!);
  if (chunk === 'VP8X' && header.length >= 30) {
    const width = 1 + (header[24]! | (header[25]! << 8) | (header[26]! << 16));
    const height = 1 + (header[27]! | (header[28]! << 8) | (header[29]! << 16));
    return { width, height };
  }
  if (chunk === 'VP8L' && header.length >= 25 && header[20] === 0x2f) {
    const bits = header[21]! | (header[22]! << 8) | (header[23]! << 16) | (header[24]! << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ' && header.length >= 30 && header[23] === 0x9d && header[24] === 0x01 && header[25] === 0x2a) {
    return {
      width: (header[26]! | (header[27]! << 8)) & 0x3fff,
      height: (header[28]! | (header[29]! << 8)) & 0x3fff,
    };
  }
  return null;
}

/**
 * Baca dimensi dari header tanpa decode penuh. JPEG/PNG/WebP adalah satu-satunya
 * format yang lolos validasi, jadi parser ini tidak perlu menangani format lain.
 * Return null bila header terpotong atau varian tidak dikenal; pemanggil boleh
 * lanjut ke decode biasa, tetapi batas piksel tidak bisa ditegakkan untuk kasus itu.
 */
export function imageDimensions(header: Uint8Array): Dimensions | null {
  return pngDimensions(header) ?? jpegDimensions(header) ?? webpDimensions(header);
}

interface OcrResult {
  text: string;
  /** Keyakinan 0-100 dari Tesseract; null bila worker tidak melaporkannya. */
  confidence: number | null;
}

export async function recognizeImageDetailed(file: File, onProgress: (n: number) => void): Promise<OcrResult> {
  const myToken = ++progressToken;
  const guarded = (n: number) => {
    if (myToken === progressToken) onProgress(n);
  };
  guarded(5);
  const input = await preprocess(file);
  let worker: any;
  try {
    worker = await getWorker();
  } catch (e) {
    throw new OcrModelError(e);
  }
  currentOnProgress = guarded;
  try {
    const { data } = await worker.recognize(input as any);
    guarded(100);
    const raw = typeof data?.confidence === 'number' ? data.confidence : null;
    const confidence = raw === null ? null : Math.max(0, Math.min(100, Math.round(raw)));
    return { text: (data.text ?? '') as string, confidence };
  } finally {
    // Hanya reset bila masih pemilik token, panggilan lebih baru menang.
    if (myToken === progressToken) currentOnProgress = () => {};
  }
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

// Bebaskan worker saat halaman ditutup permanen (pagehide non-persisted).
// Navigasi antar-route tidak terminate (reuse disengaja agar OCR kedua cepat).
// bfcache (persisted=true) jangan terminate: OCR tengah jalan akan throw dan
// worker 8MB harus reload sia-sia saat user kembali.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', (e) => {
    if ((e as PageTransitionEvent).persisted) return;
    void terminateOcr().catch(() => {});
  });
}
