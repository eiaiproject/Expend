import { recognizeImageDetailed, validateImageFile, validateFileMagic, validateImagePixels, OcrImageTooLargeError, OcrModelError } from '../../utils/ocr';
import { todayLocalISO } from '../../utils/date';
import type { ChatMessage } from '../../db/db';

export function scrollToBottom(listRef: React.RefObject<HTMLDivElement | null>, instant = false) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: instant || prefersReduced ? 'auto' : 'smooth' });
}

export async function readSharedFile(cache: Cache): Promise<File | null> {
  const fileRes = await cache.match('shared-file');
  if (!fileRes) return null;
  const blob = await fileRes.blob();
  const name = decodeURIComponent(fileRes.headers.get('x-file-name') || 'receipt.png');
  const type = fileRes.headers.get('content-type') || 'image/png';
  return new File([blob], name, { type });
}

function localDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : todayLocalISO(d);
}

export function shouldShowTime(prev: Pick<ChatMessage, 'createdAt' | 'role'> | undefined, cur: Pick<ChatMessage, 'createdAt' | 'role'>): boolean {
  if (!prev) return true;
  // createdAt is UTC. Compare local calendar days so the first message after
  // midnight in WIB still gets a time label.
  return localDay(prev.createdAt) !== localDay(cur.createdAt) || cur.role !== prev.role;
}

export async function ocrFileErrorKey(file: File): Promise<'chat.ocrFormatError' | 'chat.ocrTooLarge' | null> {
  const fileErr = validateImageFile(file);
  if (fileErr === 'format' || fileErr === 'empty') return 'chat.ocrFormatError';
  if (fileErr === 'too-large') return 'chat.ocrTooLarge';
  const magicErr = await validateFileMagic(file);
  if (magicErr === 'magic') return 'chat.ocrFormatError';
  // AI juga men-decode gambar; batas piksel harus berlaku sebelum OCR/AI.
  const pixelErr = await validateImagePixels(file);
  return pixelErr === 'too-large' ? 'chat.ocrTooLarge' : null;
}

export function ocrFailureKey(e: unknown): 'chat.ocrModelError' | 'chat.ocrReadError' | 'chat.ocrTooLarge' {
  if (e instanceof OcrImageTooLargeError) return 'chat.ocrTooLarge';
  return e instanceof OcrModelError ? 'chat.ocrModelError' : 'chat.ocrReadError';
}

export async function clearShareCache(): Promise<void> {
  try {
    const cache = await caches.open('share-cache');
    await Promise.all([cache.delete('shared-file'), cache.delete('shared-meta')]);
  } catch {
    // Cache API bisa tidak tersedia; alur share tetap memberi pesan ke user.
  }
}

// Re-export agar call site lama tetap sederhana bila butuh recognize langsung.
export { recognizeImageDetailed };
