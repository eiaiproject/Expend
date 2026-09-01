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
    const bitmap = await createImageBitmap(file);
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

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate?.();
    workerPromise = null;
  }
}
