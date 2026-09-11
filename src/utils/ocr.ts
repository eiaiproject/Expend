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

// B6: Baca orientasi EXIF dari header JPEG (offset 2-64KB).
// Helper: baca uint16 big-endian atau little-endian
function readU16(buf: Uint8Array, off: number, le: boolean): number {
  return le ? buf[off]! | (buf[off + 1]! << 8) : (buf[off]! << 8) | buf[off + 1]!;
}

// Helper: baca uint32 little-endian
function readU32LE(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8) | (buf[off + 2]! << 16) | (buf[off + 3]! << 24);
}

// Helper: baca uint32 big-endian
function readU32BE(buf: Uint8Array, off: number): number {
  return (buf[off]! << 24) | (buf[off + 1]! << 16) | (buf[off + 2]! << 8) | buf[off + 3]!;
}

// Helper: cari orientasi dari TIFF IFD entries
function findOrientationInIFD(buf: Uint8Array, tiffStart: number, ifdOffset: number, le: boolean): number {
  const base = tiffStart + ifdOffset;
  if (base + 2 > buf.length) return 1;
  const entries = readU16(buf, base, le);
  for (let e = 0; e < entries; e++) {
    const tagOff = base + 2 + e * 12;
    if (tagOff + 12 > buf.length) return 1;
    const tag = readU16(buf, tagOff, le);
    if (tag === 0x0112) return le ? buf[tagOff + 8]! : buf[tagOff + 9]!;
  }
  return 1;
}

// Helper: proses APP1 marker untuk cari orientasi
function parseAPP1(buf: Uint8Array, app1Start: number): number {
  const exifStart = app1Start + 4; // skip marker(2) + length(2)
  if (exifStart + 8 > buf.length) return 1;
  if (buf[exifStart] !== 0x45 || buf[exifStart + 1] !== 0x78) return 1; // 'Ex'
  const tiffStart = exifStart + 6;
  if (tiffStart + 8 > buf.length) return 1;
  const le = buf[tiffStart] === 0x49; // 'I' = little-endian
  const ifdOffset = le ? readU32LE(buf, tiffStart + 4) : readU32BE(buf, tiffStart + 4);
  return findOrientationInIFD(buf, tiffStart, ifdOffset, le);
}

async function getExifOrientation(file: File): Promise<number> {
  if (file.type !== 'image/jpeg') return 1;
  try {
    const buf = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    let i = 2; // skip SOI marker
    while (i < buf.length - 1) {
      if (buf[i] !== 0xFF) return 1;
      const marker = buf[i + 1]!;
      if (marker === 0xE1) return parseAPP1(buf, i);
      if (marker === 0xDA || marker === 0xD9) break; // SOS atau EOI
      i += 2 + ((buf[i + 2]! << 8) | buf[i + 3]!);
    }
    return 1;
  } catch {
    return 1;
  }
}

// B6: Terapkan rotasi EXIF berdasarkan orientasi (1-8) pada canvas.
function applyExifRotation(ctx: CanvasRenderingContext2D, w: number, h: number, orient: number): void {
  switch (orient) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
  }
}

async function preprocess(file: File): Promise<Blob | File> {
  // fast path: keep original for now, resizing only for very large images via canvas
  // to avoid 6s overhead in e2e, skip heavy processing for <1.5MP
  try {
    // B6: Untuk file kecil, cek EXIF orientation. Jika rotasi diperlukan,
    // proses via canvas agar OCR membaca struk dalam orientasi benar.
    const isSmall = file.size < 1.2 * 1024 * 1024;
    const orient = isSmall ? await getExifOrientation(file) : 1;
    if (isSmall && orient === 1) return file;

    // Hormati rotasi EXIF (foto HP portrait) bila browser mendukung opsi ini.
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      bitmap = await createImageBitmap(file);
    }
    const max = 1000;
    let { width, height } = bitmap;
    if (width <= max && height <= max && orient === 1) {
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
    // B6: applyExifRotation sebagai fallback bila createImageBitmap tidak support
    // imageOrientation option (beberapa browser lama).
    applyExifRotation(ctx, width, height, orient);
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
