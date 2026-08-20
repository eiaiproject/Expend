import { createWorker } from 'tesseract.js';

/**
 * Offline OCR via self-hosted tessdata in /tessdata (cached by the SW).
 * Worker is created per call and destroyed — heavier per call, but keeps the
 * memory footprint off the main thread between scans.
 */
export async function extractTextFromImage(
  file: Blob,
  onProgress?: (p: number) => void,
): Promise<string> {
  const worker = await createWorker(['ind', 'eng'], 1, {
    langPath: '/tessdata',
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text ?? '';
  } finally {
    await worker.terminate();
  }
}